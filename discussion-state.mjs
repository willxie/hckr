// Remember a discussion visit only after its initial preview is readable.
export function canRememberDiscussion(session) {
  return session.ready && session.target.id===session.story.id && session.failures.size===0;
}

export function initialReplyCount(session,parentId,depth,available) {
  const previous=session.previousPlans.get(parentId);
  if (previous) return Math.min(previous,available);
  if (depth>=2 || session.budget<=0 || session.collapsed.has(parentId)) return 0;
  const count=Math.min(3,available,session.budget);
  session.budget-=count;
  return count;
}
