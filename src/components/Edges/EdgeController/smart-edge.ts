import { uuid } from "@/utils/uuid";

import { ReactflowEdgeWithData } from "@/data/types";
import {
  areLinesReverseDirection,
  distance,
  ILine,
  isHorizontalFromPosition,
  isLineContainsPoint,
} from "@/layout/edge/edge";
import {
  ControlPoint,
  getOffsetPoint,
  reducePoints,
} from "@/layout/edge/point";
import { kReactflow } from "@/states/reactflow";
import { EdgeControllersParams } from ".";
import { rebuildEdge } from "../BaseEdge/useRebuildEdge";

interface EdgeContext extends EdgeControllersParams {
  source: ControlPoint;
  target: ControlPoint;
  sourceOffset: ControlPoint;
  targetOffset: ControlPoint;
}

export const getEdgeContext = (props: EdgeControllersParams): EdgeContext => {
  const { points, offset, sourcePosition, targetPosition } = props;
  const source = points[0];
  const target = points[points.length - 1];
  const sourceOffset = getOffsetPoint(
    { ...source, position: sourcePosition },
    offset
  );
  const targetOffset = getOffsetPoint(
    { ...target, position: targetPosition },
    offset
  );
  return { ...props, source, target, sourceOffset, targetOffset };
};

export class SmartEdge {
  static draggingEdge?: {
    dragId: string;
    dragFrom?: string;
    target?: {
      start: ControlPoint;
      end: ControlPoint;
    };
    start: ControlPoint;
    end: ControlPoint;
  };

  public idx: number;
  public start: ControlPoint;
  public end: ControlPoint;
  public distance: number;
  public ctx: EdgeContext;

  public previous?: SmartEdge;
  public next?: SmartEdge;

  constructor(options: {
    idx: number;
    start: ControlPoint;
    end: ControlPoint;
    ctx: EdgeContext;
    previous?: SmartEdge;
    next?: SmartEdge;
  }) {
    this.idx = options.idx;
    this.start = options.start;
    this.end = options.end;
    this.ctx = options.ctx;
    this.previous = options.previous;
    this.next = options.next;
    this.distance = distance(this.start, this.end);
  }

  get isHorizontalLayout() {
    return isHorizontalFromPosition(this.ctx.sourcePosition);
  }

  get isHorizontalLine() {
    return this.start.y === this.end.y;
  }

  get isSource() {
    return this.idx === 0;
  }

  get isSourceOffset() {
    return this.idx === 1;
  }

  get isTarget() {
    return this.idx === this.ctx.points.length - 2;
  }

  get isTargetOffset() {
    return this.idx === this.ctx.points.length - 3;
  }

  get isStartFixed() {
    return this.isSource || this.isSourceOffset;
  }

  get isEndFixed() {
    return this.isTarget || this.isTargetOffset;
  }

  get minHandlerWidth() {
    return this.ctx.handlerWidth + 2 * this.ctx.offset;
  }

  /**
   * 是否可以拖动
   *
   * Whether to drag
   */
  get canDrag() {
    if (this.isStartFixed || this.isEndFixed) {
      // 两端连接线要在可拆分边之后，才可以拖动
      // The connection lines on both ends should not be dragged after the disassembly can be dragged
      return this.canSplit;
    }
    return this.distance >= this.minHandlerWidth;
  }

  /**
   * 是否可以拆分边
   *
   * Can it be split
   */
  get canSplit() {
    return this.distance >= this.minHandlerWidth + 2 * this.ctx.offset;
  }

  /**
   * 两端存在固定端点时，自动拆分边
   *
   * When there is a fixed end point at both ends, automatically split edges
   */
  splitPoints(
    dragId: string,
    from: ILine,
    _to: ILine,
    minGap = 10
  ): ControlPoint[] | undefined {
    const startPoints = this.ctx.points.slice(0, this.idx + 1);
    const endPoints = this.ctx.points.slice(this.idx + 1);

    let to = { ..._to };
    const isTempDraggingEdge =
      SmartEdge.draggingEdge?.dragId === dragId &&
      SmartEdge.draggingEdge?.target;
    if (isTempDraggingEdge) {
      // 在缓存点的基础上修正偏移量
      // Correct the offset on the basis of the cache point
      to = {
        start: {
          id: uuid(),
          x:
            SmartEdge.draggingEdge!.target!.start.x +
            (to.start.x - from.start.x),
          y:
            SmartEdge.draggingEdge!.target!.start.y +
            (to.start.y - from.start.y),
        },
        end: {
          id: uuid(),
          x: SmartEdge.draggingEdge!.target!.end.x + (to.end.x - from.end.x),
          y: SmartEdge.draggingEdge!.target!.end.y + (to.end.y - from.end.y),
        },
      };
    }

    // 是否需要拆分
    // Do you need to split
    let needSplit = false;
    // 是否开始拆分
    // Whether to start splitting
    let startSplit = false;

    const sourceDelta = this.isHorizontalLine
      ? Math.abs(this.ctx.source.y - to.start.y)
      : Math.abs(this.ctx.source.x - to.start.x);
    const targetDelta = this.isHorizontalLine
      ? Math.abs(this.ctx.target.y - to.end.y)
      : Math.abs(this.ctx.target.x - to.end.x);
    const moveDelta = this.isHorizontalLine
      ? Math.abs(from.start.y - to.start.y)
      : Math.abs(from.start.x - to.start.x);

    if (this.isSource) {
      needSplit = true;
      if (sourceDelta > minGap) {
        startSplit = true;
      }
    } else if (this.isTarget) {
      needSplit = true;
      if (targetDelta > minGap) {
        startSplit = true;
      }
    } else {
      if (this.isSourceOffset && sourceDelta < this.ctx.offset) {
        needSplit = true;
        if (moveDelta > minGap) {
          startSplit = true;
        }
      } else if (this.isTargetOffset && targetDelta < this.ctx.offset) {
        needSplit = true;
        if (moveDelta > minGap) {
          startSplit = true;
        }
      }
    }

    if (!needSplit) {
      return;
    }

    const _offset = (distance(from.start, from.end) - this.minHandlerWidth) / 2;
    if (this.isHorizontalLine) {
      const direction = from.start.x < from.end.x ? 1 : -1;
      const offset = _offset * direction;
      if (!startSplit) {
        SmartEdge.draggingEdge = {
          dragId,
          start: from.start,
          end: from.end,
          target: { start: to.start, end: to.end },
        };
        return this.ctx.points;
      }
      SmartEdge.draggingEdge = {
        dragId,
        start: { id: uuid(), x: from.start.x + offset, y: to.start.y },
        end: { id: uuid(), x: from.end.x - offset, y: to.start.y },
      };
      return [
        ...startPoints,
        { id: uuid(), x: from.start.x + offset, y: from.start.y },
        SmartEdge.draggingEdge.start,
        SmartEdge.draggingEdge.end,
        { id: uuid(), x: from.end.x - offset, y: from.start.y },
        ...endPoints,
      ];
    } else {
      const direction = from.start.y < from.end.y ? 1 : -1;
      const offset = _offset * direction;
      if (!startSplit) {
        SmartEdge.draggingEdge = {
          dragId,
          start: from.start,
          end: from.end,
          target: { start: to.start, end: to.end },
        };
        return this.ctx.points;
      }
      SmartEdge.draggingEdge = {
        dragId,
        start: { id: uuid(), x: to.start.x, y: from.start.y + offset },
        end: { id: uuid(), x: to.start.x, y: from.end.y - offset },
      };
      return [
        ...startPoints,
        { id: uuid(), x: from.start.x, y: from.start.y + offset },
        SmartEdge.draggingEdge.start,
        SmartEdge.draggingEdge.end,
        { id: uuid(), x: from.start.x, y: from.end.y - offset },
        ...endPoints,
      ];
    }
  }

  /**
   * 合并相近的边
   *
   * Similar edges
   */
  mergePoints(
    dragId: string,
    from: ILine,
    to: ILine,
    minGap = 10
  ): ControlPoint[] | undefined {
    const startPoints = this.previous
      ? this.ctx.points.slice(0, this.previous.idx)
      : [];
    const endPoints = this.next
      ? this.ctx.points.slice(this.next.idx + 1 + 1)
      : [];
    if (this.isHorizontalLine) {
      const fromY = from.start.y;
      const toY = to.start.y;
      const preY = this.previous?.start.y;
      const nextY = this.next?.start.y;
      // 找到与目标坐标最近的边
      // Find the edge closest to the target coordinates
      const targetY = preY
        ? nextY
          ? Math.abs(toY - preY) < Math.abs(toY - nextY)
            ? preY
            : nextY
          : preY
        : nextY!;
      // 确定是否需要合并（1. 靠近吸附对象 2. 靠的足够近）
      // Determine whether you need to be merged (1. Near adsorption objects 2. Depending enough)
      const currentDistance = Math.abs(toY - targetY);
      const needMerge =
        Math.abs(fromY - targetY) > currentDistance && currentDistance < minGap;
      if (needMerge) {
        // 合并到新端点
        // Merge to new endpoint
        if (preY === nextY && preY === targetY) {
          // previous, current, next 合并成一条直线
          // Previous, Current, Next merged into a straight line
          SmartEdge.draggingEdge = {
            dragId,
            start: this.previous!.start,
            end: this.next!.end,
          };
          return [
            ...startPoints,
            SmartEdge.draggingEdge.start,
            SmartEdge.draggingEdge.end,
            ...endPoints,
          ];
        } else if (preY === targetY) {
          if (this.next) {
            // previous, current 合并成一条直线
            // Previous, Current merged into a straight line
            SmartEdge.draggingEdge = {
              dragId,
              start: this.previous!.start,
              end: { id: uuid(), x: from.end.x, y: preY }, // 新端点（投影） // New endpoint (projection)
            };
            return [
              ...startPoints,
              SmartEdge.draggingEdge.start,
              SmartEdge.draggingEdge.end,
              this.next!.start,
              this.next!.end,
              ...endPoints,
            ];
          } else {
            // next 为空
            // Next is empty
            SmartEdge.draggingEdge = {
              dragId,
              start: this.previous!.start,
              end: { id: uuid(), x: from.end.x, y: preY }, // 新端点（投影） // New endpoint (projection)
            };
            return [
              ...startPoints,
              SmartEdge.draggingEdge.start,
              SmartEdge.draggingEdge.end,
              this.ctx.target,
              ...endPoints,
            ];
          }
        } else {
          if (this.previous) {
            // current, next 合并成一条直线
            // Current, next merged into a straight line
            SmartEdge.draggingEdge = {
              dragId,
              start: { id: uuid(), x: from.start.x, y: nextY! }, // 新端点（投影） // New endpoint (projection)
              end: this.next!.end,
            };
            return [
              ...startPoints,
              this.previous!.start,
              this.previous!.end,
              SmartEdge.draggingEdge.start,
              SmartEdge.draggingEdge.end,
              ...endPoints,
            ];
          } else {
            // previous 为空
            // Previous is empty
            SmartEdge.draggingEdge = {
              dragId,
              start: { id: uuid(), x: from.start.x, y: nextY! }, // 新端点（投影） // New endpoint (projection)
              end: this.next!.end,
            };
            return [
              ...startPoints,
              this.ctx.source,
              SmartEdge.draggingEdge.start,
              SmartEdge.draggingEdge.end,
              ...endPoints,
            ];
          }
        }
      }
    } else {
      const fromX = from.start.x;
      const toX = to.start.x;
      const preX = this.previous?.start.x;
      const nextX = this.next?.start.x;
      // 找到与目标坐标最近的边
      // Find the edge closest to the target coordinates
      const targetX = preX
        ? nextX
          ? Math.abs(toX - preX) < Math.abs(toX - nextX)
            ? preX
            : nextX
          : preX
        : nextX!;
      // 确定是否需要合并（1. 靠近吸附对象 2. 靠的足够近）
      // Determine whether you need to be merged (1. Near adsorption objects 2. Depending enough)
      const currentDistance = Math.abs(toX - targetX);
      const needMerge =
        Math.abs(fromX - targetX) > currentDistance && currentDistance < minGap;
      if (needMerge) {
        // 合并到新端点
        // Merge to new endpoint
        if (preX === nextX && preX === targetX) {
          // previous, current, next 合并成一条直线
          // Previous, Current, Next merged into a straight line
          SmartEdge.draggingEdge = {
            dragId,
            start: this.previous!.start,
            end: this.next!.end,
          };
          return [
            ...startPoints,
            SmartEdge.draggingEdge.start,
            SmartEdge.draggingEdge.end,
            ...endPoints,
          ];
        } else if (preX === targetX) {
          if (this.next) {
            // previous, current 合并成一条直线
            // Previous, Current merged into a straight line
            SmartEdge.draggingEdge = {
              dragId,
              start: this.previous!.start,
              end: { id: uuid(), x: preX, y: from.end.y }, // 新端点（投影） // New endpoint (projection)
            };
            return [
              ...startPoints,
              SmartEdge.draggingEdge.start,
              SmartEdge.draggingEdge.end,
              this.next!.start,
              this.next!.end,
              ...endPoints,
            ];
          } else {
            // next 为空
            // Next is empty
            SmartEdge.draggingEdge = {
              dragId,
              start: this.previous!.start,
              end: { id: uuid(), x: preX, y: from.end.y }, // 新端点（投影） // New endpoint (projection)
            };
            return [
              ...startPoints,
              SmartEdge.draggingEdge.start,
              SmartEdge.draggingEdge.end,
              this.ctx.target,
              ...endPoints,
            ];
          }
        } else {
          if (this.previous) {
            // current, next 合并成一条直线
            // Current, next merged into a straight line
            SmartEdge.draggingEdge = {
              dragId,
              start: { id: uuid(), x: nextX!, y: from.start.y }, // 新端点（投影） // New endpoint (projection)
              end: this.next!.end,
            };
            return [
              ...startPoints,
              this.previous!.start,
              this.previous!.end,
              SmartEdge.draggingEdge.start,
              SmartEdge.draggingEdge.end,
              ...endPoints,
            ];
          } else {
            // previous 为空
            // Previous is empty
            SmartEdge.draggingEdge = {
              dragId,
              start: { id: uuid(), x: nextX!, y: from.start.y }, // 新端点（投影） // New endpoint (projection)
              end: this.next!.end,
            };
            return [
              ...startPoints,
              this.ctx.source,
              SmartEdge.draggingEdge.start,
              SmartEdge.draggingEdge.end,
              ...endPoints,
            ];
          }
        }
      }
    }
  }

  /**
   * 检查路径是否有效
   *
   * 1. 有重叠的路径无效
   * 2. 不包含 offset 无效
   *
   * Check whether the path is effective
   *
   * 1. There is an overlapping path invalid
   * 2. No offset invalid
   */
  isValidPoints = (points: ControlPoint[]): boolean => {
    if (points.length < 4) {
      // 3 条边以下的路径总是有效的
      // 3 The path below the edge is always effective
      return true;
    }
    const edges: ILine[] = [
      { start: points[0], end: points[1] },
      { start: points[1], end: points[2] },
      { start: points[points.length - 3], end: points[points.length - 2] },
      { start: points[points.length - 2], end: points[points.length - 1] },
    ];
    // 不包含 offset 无效
    // No offset invalid
    if (
      !isLineContainsPoint(
        edges[0].start,
        edges[0].end,
        this.ctx.sourceOffset
      ) ||
      !isLineContainsPoint(edges[3].start, edges[3].end, this.ctx.targetOffset)
    ) {
      return false;
    }
    // 有重叠的路径无效
    // There is an overlapping path invalid
    if (
      areLinesReverseDirection(
        edges[0].start,
        edges[0].end,
        edges[1].start,
        edges[1].end
      ) ||
      areLinesReverseDirection(
        edges[2].start,
        edges[2].end,
        edges[3].start,
        edges[3].end
      )
    ) {
      return false;
    }
    return true;
  };

  rebuildEdge = (points: ControlPoint[]) => {
    const edge: ReactflowEdgeWithData = kReactflow.instance!.getEdge(
      this.ctx.id
    )!;
    edge.data!.layout!.points = reducePoints(points);
    rebuildEdge(this.ctx.id);
  };

  onDragging = ({
    dragId,
    from,
    to,
  }: {
    dragId: string;
    dragFrom: string;
    from: ILine;
    to: ILine;
  }) => {
    if (distance(from.start, to.start) < 0.00001) {
      // 拖动距离较近，仅刷新
      // The drag distance is closer, only refresh
      return this.rebuildEdge(this.ctx.points);
    }
    // 两端存在固定端点，自动拆分边
    // There are fixed endpoints at both ends, automatic split
    if (this.isStartFixed || this.isEndFixed) {
      const splittedPoints = this.splitPoints(dragId, from, to);
      if (splittedPoints) {
        return this.rebuildEdge(splittedPoints);
      }
    }
    // 合并相近边
    // Consolidate
    const mergedPoints = this.mergePoints(dragId, from, to);
    if (mergedPoints && this.isValidPoints(mergedPoints)) {
      return this.rebuildEdge(mergedPoints);
    }
    // 更新 current 边坐标
    // Update Current edge coordinates
    const { x: targetX, y: targetY } = to.start;
    if (this.isHorizontalLine) {
      this.start.y = targetY;
      this.end.y = targetY;
    } else {
      this.start.x = targetX;
      this.end.x = targetX;
    }
    SmartEdge.draggingEdge = { dragId, start: this.start, end: this.end };
    // 刷新
    // refresh
    this.rebuildEdge(this.ctx.points);
  };
}
