/**
 * The switch that lets the landing page hide things.
 *
 * Every entrance on this page hides its element and relies on an animation to
 * bring it back. That is safe only while the animation is guaranteed to run,
 * and it is not: Chrome does not start the document timeline until a tab has
 * been visible at least once, so a page opened in a background tab holds every
 * entrance at its 0% keyframe forever. Measured on production, in a tab that
 * had never been foregrounded, `document.timeline.currentTime` was 0 while
 * `performance.now()` was past two minutes, and the hero image, the lede and
 * the headline were all present and all invisible.
 *
 * So the hiding is gated on this attribute and this attribute is set only when
 * the document is genuinely visible. Absent it, nothing hides and the page is
 * simply still.
 *
 * ## Why an inline script rather than an effect
 *
 * A React effect runs after hydration, which is hundreds of milliseconds and a
 * JavaScript bundle away. In that window the page would be unstyled by the
 * gate, then suddenly hide itself and animate back in, which is a flash of
 * finished content followed by a flicker. This runs before first paint, in the
 * head, with no dependency on the bundle arriving at all.
 *
 * ## Fail visible
 *
 * Every branch that is not "we are certain motion will run" leaves the
 * attribute unset. Script blocked by a content policy, an exception in an older
 * browser, reduced motion, a tab that is never foregrounded: all of them end
 * with a page that shows its content. That is the whole point, and it is worth
 * stating plainly because the tempting version of this file sets the attribute
 * first and removes it on failure, which fails blank.
 */
export function MotionGate() {
  const script = `(function(){try{
var d=document,r=d.documentElement;
if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
function on(){r.setAttribute('data-motion','on')}
if(d.visibilityState==='visible'){on();return}
var h=function(){if(d.visibilityState==='visible'){on();d.removeEventListener('visibilitychange',h)}};
d.addEventListener('visibilitychange',h)
}catch(e){}})();`;

  // Not next/script: this has to run before first paint, in the head, and
  // beforeInteractive still defers to the framework's own loading. It is 300
  // bytes and it decides whether the page is visible, so it goes inline.
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
