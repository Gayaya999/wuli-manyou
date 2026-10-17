// Scientist-owned works stay inside that scientist's module.
export function worksForScientist(posts, scientistId) {
  if (!scientistId) return [];
  return posts.filter((post) => post.play && !post.hidden && post.scientist_id === scientistId);
}
