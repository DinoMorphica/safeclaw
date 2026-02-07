import type { AgentActivity } from "@safeclaw/shared";
import { parseRawPayload } from "./activityParser.js";

export interface GroupedInteraction {
  primary: AgentActivity; // Most recent activity in this interaction
  activities: AgentActivity[]; // All activities in this interaction (sorted chronologically)
  runId: string; // Interaction/run identifier
}

export function groupActivitiesByInteraction(
  activities: AgentActivity[],
): GroupedInteraction[] {
  const groups = new Map<string, AgentActivity[]>();

  // Group activities by runId (interaction)
  for (const activity of activities) {
    const parsed = parseRawPayload(activity.rawPayload);
    const key = parsed.runId || `fallback-${activity.id}`;

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

