export default defineBackground(() => {
  // Minimal service worker — fill logic runs in the active tab via scripting.
  console.log('[journal-autofill] background ready');
});
