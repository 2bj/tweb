type EmojiRenderLoopCandidate = {
  isConnected: boolean,
  ignoreSettingDimensions: boolean,
  checkForAnyFrame: () => boolean,
  playersSynced: Map<unknown, {paused?: boolean}>
};

/** True when the 60fps compositor tick has work (playing synced emoji), not merely connected renderers. */
export function customEmojiRenderLoopNeedsTick(renderers: EmojiRenderLoopCandidate[]) {
  if(typeof document !== 'undefined' && document.hidden) {
    return false;
  }

  const t = renderers.filter((r) => r.isConnected && r.checkForAnyFrame() && !r.ignoreSettingDimensions);
  if(!t.length) {
    return false;
  }

  for(const renderer of t) {
    const paused = [...renderer.playersSynced.values()].reduce((acc, v) => acc + +!!v.paused, 0);
    if(renderer.playersSynced.size !== paused) {
      return true;
    }
  }

  return false;
}
