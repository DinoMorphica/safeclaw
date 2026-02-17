import type { AgentActivity } from "@safeclaw/shared";

export interface GroupedInteraction {
  primary: AgentActivity; // Most recent activity in this interaction
  activities: AgentActivity[]; // All activities in this interaction (sorted chronologically)
  runId: string; // Interaction/run identifier
}

export function groupActivitiesByInteraction(
  activities: AgentActivity[],
): GroupedInteraction[] {
  const groups = new Map<string, AgentActivity[]>();

  // Group activities by runId (interaction) — use the field directly on the activity
  for (const activity of activities) {
    const key = activity.runId || `fallback-${activity.id}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(activity);
  }

  // Convert groups to GroupedInteraction array
  const interactions = Array.from(groups.entries()).map(([runId, group]) => {
    // Sort group by timestamp chronologically within the interaction
    const sortedActivities = group.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    return {
      primary: sortedActivities[sortedActivities.length - 1], // Most recent activity
      activities: sortedActivities,
      runId,
    };
  });

  // Sort interactions by most recent first (newest at the top)
  return interactions.sort(
    (a, b) =>
      new Date(b.primary.timestamp).getTime() -
      new Date(a.primary.timestamp).getTime(),
  );
}

// Keep the old function name for backwards compatibility during migration
export const groupActivitiesByToolCall = groupActivitiesByInteraction;

