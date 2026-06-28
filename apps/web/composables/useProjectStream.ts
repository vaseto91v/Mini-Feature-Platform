import type { ActivityType, TaskStatus } from "@mfp/shared";

interface StreamEvent {
  id: string;
  tenantId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

/**
 * Subscribes to the project's SSE stream and reconciles incoming events into the
 * board + activity stores. The actor's *own* events are skipped on the board
 * (already applied optimistically) but still recorded in the activity feed.
 */
export function useProjectStream(projectId: string) {
  const config = useRuntimeConfig();
  const auth = useAuthStore();
  const board = useBoardStore();
  const activity = useActivityStore();
  let es: EventSource | null = null;

  function onEvent(event: StreamEvent): void {
    const p = event.payload;
    activity.prepend({
      id: event.id,
      tenantId: event.tenantId,
      projectId: typeof p.projectId === "string" ? p.projectId : null,
      type: event.type as ActivityType,
      actorId: typeof p.actorId === "string" ? p.actorId : null,
      data: p,
      createdAt: event.createdAt,
    });

    const isOwn = !!auth.user && p.actorId === auth.user.id;
    if (isOwn) return; // board already reflects our own optimistic change

    if (event.type === "task.created") {
      board.applyRemoteTask({
        id: p.taskId as string,
        tenantId: event.tenantId,
        projectId: p.projectId as string,
        title: p.title as string,
        status: p.status as TaskStatus,
        createdAt: event.createdAt,
      });
    } else if (event.type === "task.status_changed") {
      board.applyRemoteStatus(p.taskId as string, p.to as TaskStatus);
    }
  }

  function connect(): void {
    if (es || !auth.accessToken) return;
    const url = `${config.public.apiBase}/api/projects/${projectId}/stream?token=${encodeURIComponent(auth.accessToken)}`;
    es = new EventSource(url);
    const handler = (e: MessageEvent) => {
      try {
        onEvent(JSON.parse(e.data));
      } catch {
        /* ignore malformed frames */
      }
    };
    for (const type of ["project.created", "task.created", "task.status_changed"]) {
      es.addEventListener(type, handler as EventListener);
    }
  }

  function disconnect(): void {
    es?.close();
    es = null;
  }

  return { connect, disconnect };
}
