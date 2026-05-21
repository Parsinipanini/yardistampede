/* =========================================================
   Calgary Stampede — Yardi storybook invitation
   Plain JS, GSAP for tweens. No bundler.
   ========================================================= */

(() => {
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  const TOTAL_PAGES = 4;             // 4 content pages + 1 cover
  const FLIP_DURATION = 1.05;        // seconds
  const FLIP_COMMIT_THRESHOLD = 0.4; // 40% of page width = commit
  const DRAG_FRICTION = 1.2;         // higher = more drag needed to flip

  const book        = $('#book');
  const stage       = $('#stage');
  const loader      = $('#loader');
  const coverOpen   = $('#coverOpen');
  const navPrev     = $('#navPrev');
  const navNext     = $('#navNext');
  const soundToggle = $('#soundToggle');
  const hint        = $('#hint');
  const pageNow     = $('#pageNow');
  const pageTotal   = $('#pageTotal');
  const pages       = $$('.page', book).sort(
    (a, b) => Number(a.dataset.page) - Number(b.dataset.page)
  );

  pageTotal.textContent = TOTAL_PAGES;

  let current      = 0;        // index of the visible "right side" — 0 = cover showing
  let isAnimating  = false;
  let soundOn      = true;
  let hasOpened    = false;
  const pageLabels = ['Cover', 'Invitation', 'Programme', 'About & Travel', 'RSVP'];

  /* =========================================================
     LOADER
     ========================================================= */
  window.addEventListener('load', () => {
    setTimeout(() => loader.classList.add('is-hidden'), 600);
  });

  /* =========================================================
     PAGE-TURN SFX (Web Audio API — filtered noise burst)
     ========================================================= */
  let audioCtx = null;
  const ensureAudio = () => {
    if (audioCtx) return audioCtx;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) { /* no-op */ }
    return audioCtx;
  };

  const playPageTurn = () => {
    if (!soundOn) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const duration = 0.28;
    const now = ctx.currentTime;

    // Noise buffer
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // pink-ish noise with a slight envelope
      const t = i / bufferSize;
      const env = Math.pow(1 - t, 1.8) * (1 + Math.sin(t * 28) * 0.18);
      data[i] = (Math.random() * 2 - 1) * env * 0.9;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    // Bandpass for "paper" character
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200;
    bp.Q.value = 0.9;

    // High-shelf boost for crisp rustle
    const hi = ctx.createBiquadFilter();
    hi.type = 'highshelf';
    hi.frequency.value = 4500;
    hi.gain.value = 6;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(bp).connect(hi).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + duration + 0.02);
  };

  /* =========================================================
     SOUND TOGGLE
     ========================================================= */
  soundToggle.addEventListener('click', () => {
    soundOn = !soundOn;
    soundToggle.setAttribute('aria-pressed', String(soundOn));
    if (soundOn) playPageTurn();
  });

  /* =========================================================
     PAGE INDICATOR
     ========================================================= */
  const updateIndicator = () => {
    pageNow.textContent = pageLabels[current] || `Page ${current}`;
    navPrev.disabled = current <= 0;
    navNext.disabled = current >= TOTAL_PAGES;
  };

  /* =========================================================
     OPEN THE BOOK (cover → page 1)
     ========================================================= */
  const openBook = () => {
    if (hasOpened) return;
    hasOpened = true;
    book.classList.add('is-open');
    // Small delay so the book has time to flatten before the page flips
    setTimeout(() => flipForward(), 600);
    // Fade out the hint after first interaction
    setTimeout(() => hint.classList.add('is-hidden'), 4000);
  };

  coverOpen.addEventListener('click', (e) => {
    e.stopPropagation();
    openBook();
  });

  /* =========================================================
     FLIP — programmatic (button / keyboard / click-corner)
     ========================================================= */
  const flipForward = () => {
    if (isAnimating || current >= TOTAL_PAGES) return;
    const page = pages[current];
    if (!page) return;
    if (!hasOpened && current === 0) {
      openBook();
      return;
    }
    animateFlip(page, +1);
  };

  const flipBackward = () => {
    if (isAnimating || current <= 0) return;
    const page = pages[current - 1];
    if (!page) return;
    animateFlip(page, -1);
  };

  const animateFlip = (page, direction) => {
    isAnimating = true;
    book.classList.add('is-animating');
    page.classList.add('is-flipping');

    const targetAngle = direction === +1 ? -180 : 0;

    gsap.to(page, {
      rotateY: targetAngle,
      duration: FLIP_DURATION,
      ease: 'power2.inOut',
      onStart: () => playPageTurn(),
      onComplete: () => {
        if (direction === +1) {
          page.classList.add('is-flipped');
          current += 1;
        } else {
          page.classList.remove('is-flipped');
          current -= 1;
        }
        gsap.set(page, { clearProps: 'transform' });
        page.classList.remove('is-flipping');
        book.classList.remove('is-animating');
        isAnimating = false;
        updateIndicator();
      }
    });
  };

  navNext.addEventListener('click', flipForward);
  navPrev.addEventListener('click', flipBackward);

  /* =========================================================
     CORNER CLICKS (no-drag tap = flip)
     ========================================================= */
  $$('.page__corner').forEach(corner => {
    corner.addEventListener('click', (e) => {
      if (corner.dataset.dragged === 'true') {
        corner.dataset.dragged = 'false';
        return;
      }
      const direction = corner.dataset.direction;
      if (direction === 'next') flipForward();
      else if (direction === 'prev') flipBackward();
      e.stopPropagation();
    });
  });

  /* =========================================================
     KEYBOARD NAVIGATION
     ========================================================= */
  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault();
      flipForward();
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      flipBackward();
    } else if (e.key === 'Home') {
      // jump back to cover quickly
      while (current > 0) {
        const p = pages[current - 1];
        if (!p) break;
        p.classList.remove('is-flipped');
        current--;
      }
      updateIndicator();
    }
  });

  /* =========================================================
     DRAG TO FLIP
     ========================================================= */
  const setupDrag = (corner) => {
    const direction = corner.dataset.direction; // "next" or "prev"

    let dragging = false;
    let startX = 0;
    let startTime = 0;
    let targetPage = null;
    let bookWidth = 0;
    let pointerId = null;

    const onDown = (e) => {
      if (isAnimating) return;
      if (!hasOpened) { openBook(); return; }

      // Resolve which page we're dragging
      if (direction === 'next') {
        if (current >= TOTAL_PAGES) return;
        targetPage = pages[current];
      } else {
        if (current <= 0) return;
        targetPage = pages[current - 1];
      }
      if (!targetPage) return;

      dragging = true;
      startX = e.clientX;
      startTime = performance.now();
      bookWidth = book.getBoundingClientRect().width;
      pointerId = e.pointerId;
      corner.setPointerCapture(pointerId);
      corner.dataset.dragged = 'false';

      targetPage.classList.add('is-flipping');
      book.classList.add('is-animating');
      gsap.killTweensOf(targetPage);
      // remove transition so we can drive transform directly
      targetPage.style.transition = 'none';

      e.preventDefault();
    };

    const onMove = (e) => {
      if (!dragging || !targetPage) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 5) corner.dataset.dragged = 'true';

      let progress;
      if (direction === 'next') {
        // Dragging next: pulling left → flip from 0 to -180
        progress = clamp(-dx / (bookWidth * DRAG_FRICTION), 0, 1);
      } else {
        // Dragging prev: pulling right → un-flip from -180 to 0
        progress = clamp(1 - (dx / (bookWidth * DRAG_FRICTION)), 0, 1);
      }
      const angle = -180 * progress;
      targetPage.style.transform = `rotateY(${angle}deg)`;
    };

    const onUp = (e) => {
      if (!dragging || !targetPage) return;
      dragging = false;

      const dx = e.clientX - startX;
      const dt = performance.now() - startTime;
      const speed = Math.abs(dx) / Math.max(dt, 1); // px/ms

      // Compute current progress same way as onMove
      let progress;
      if (direction === 'next') {
        progress = clamp(-dx / (bookWidth * DRAG_FRICTION), 0, 1);
      } else {
        progress = clamp(1 - (dx / (bookWidth * DRAG_FRICTION)), 0, 1);
      }

      // Commit if past threshold OR a quick flick
      const flicked = speed > 0.45 && Math.abs(dx) > 30;
      const passedHalf = progress > FLIP_COMMIT_THRESHOLD;
      const commit = direction === 'next'
        ? (passedHalf || (flicked && dx < 0))
        : (progress < (1 - FLIP_COMMIT_THRESHOLD) || (flicked && dx > 0));

      // Restore transition
      targetPage.style.transition = '';

      try { corner.releasePointerCapture(pointerId); } catch (_) {}
      pointerId = null;

      // Compute remaining tween
      const startAngle = -180 * progress;
      const endAngle   = commit
        ? (direction === 'next' ? -180 : 0)
        : (direction === 'next' ? 0 : -180);
      const remainingFraction = Math.abs(endAngle - startAngle) / 180;
      const duration = Math.max(0.3, FLIP_DURATION * remainingFraction);

      isAnimating = true;
      // Sync GSAP starting point
      gsap.set(targetPage, { rotateY: startAngle });
      gsap.to(targetPage, {
        rotateY: endAngle,
        duration,
        ease: 'power2.out',
        onStart: () => {
          if (commit) playPageTurn();
        },
        onComplete: () => {
          if (commit) {
            if (direction === 'next') {
              targetPage.classList.add('is-flipped');
              current += 1;
            } else {
              targetPage.classList.remove('is-flipped');
              current -= 1;
            }
          }
          gsap.set(targetPage, { clearProps: 'transform' });
          targetPage.classList.remove('is-flipping');
          book.classList.remove('is-animating');
          isAnimating = false;
          updateIndicator();
        }
      });
    };

    corner.addEventListener('pointerdown', onDown);
    corner.addEventListener('pointermove', onMove);
    corner.addEventListener('pointerup', onUp);
    corner.addEventListener('pointercancel', onUp);
  };

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  $$('.page__corner').forEach(setupDrag);

  /* =========================================================
     MOUSE-PARALLAX on the scene & subtle book tilt
     ========================================================= */
  const scene = $('.scene');
  const layers = [
    { el: $('.scene__clouds--far'),  intensity: 12 },
    { el: $('.scene__clouds--near'), intensity: 22 },
    { el: $('.scene__mountains'),    intensity: 6  },
    { el: $('.scene__hills'),        intensity: 10 },
    { el: $('.scene__foreground'),   intensity: 14 },
    { el: $('.scene__sun'),          intensity: 4  },
    { el: $('.stampede'),            intensity: 8  }
  ].filter(l => l.el);

  let mx = 0, my = 0, tx = 0, ty = 0;
  const onMouseMove = (e) => {
    const w = window.innerWidth, h = window.innerHeight;
    mx = (e.clientX / w - 0.5);
    my = (e.clientY / h - 0.5);
  };
  window.addEventListener('mousemove', onMouseMove, { passive: true });

  const raf = () => {
    tx += (mx - tx) * 0.05;
    ty += (my - ty) * 0.05;
    layers.forEach(({ el, intensity }) => {
      el.style.transform = `translate3d(${-tx * intensity}px, ${-ty * intensity * 0.4}px, 0)`;
    });
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);

  /* =========================================================
     AMBIENT SCENERY ANIMATIONS
     ========================================================= */
  // Drifting clouds
  gsap.utils.toArray('.cloud').forEach((cloud, i) => {
    const dur = 60 + Math.random() * 50;
    const offset = -120 - Math.random() * 60;
    gsap.fromTo(cloud,
      { x: offset + (i * 40) },
      {
        x: window.innerWidth + 200,
        duration: dur,
        repeat: -1,
        ease: 'none',
        delay: i * 6
      }
    );
  });

  // Galloping horses — continuous stampede across the viewport in three depth layers.
  gsap.utils.toArray('.horse').forEach((horse) => {
    const isFar  = horse.classList.contains('horse--far');
    const isNear = horse.classList.contains('horse--near');

    // Depth dictates speed: near horses sweep fast, far horses crawl
    const baseDur = isFar ? 38 : isNear ? 18 : 26;
    const duration = baseDur + (Math.random() * 6);
    const bobAmount = isNear ? 12 : isFar ? 4 : 8;

    // Vertical bob (gallop bounce)
    gsap.to(horse, {
      y: '-=' + bobAmount,
      duration: 0.26 + Math.random() * 0.1,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut'
    });

    // Continuous left-to-right sweep, distributed randomly through the loop
    const sweepW = window.innerWidth + 400;
    gsap.set(horse, { left: 0, x: -300 });
    const tween = gsap.to(horse, {
      x: sweepW,
      duration,
      repeat: -1,
      ease: 'none'
    });
    tween.progress(Math.random());
  });

  // Cowboys gently sway
  gsap.utils.toArray('.cowboy').forEach((cowboy, i) => {
    gsap.to(cowboy, {
      y: '-=4',
      duration: 2.4 + i * 0.6,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut'
    });
  });

  /* =========================================================
     RSVP FORM
     ========================================================= */
  const form = $('#rsvpForm');
  const success = $('#rsvpSuccess');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const action = form.getAttribute('action') || '';
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      // If the user hasn't set a real Formspree URL yet, just show the success state.
      if (!action || action.includes('YOUR_FORM_ID')) {
        showSuccess();
        return;
      }

      try {
        const data = new FormData(form);
        const res = await fetch(action, {
          method: 'POST',
          body: data,
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) showSuccess();
        else {
          alert('Sorry, we could not send your RSVP. Please email your Yardi host directly.');
          if (submitBtn) submitBtn.disabled = false;
        }
      } catch (_) {
        alert('Sorry, we could not send your RSVP. Please email your Yardi host directly.');
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    function showSuccess() {
      // hide the inputs, reveal success
      $$('.rsvp__row, .field--full, .rsvp__actions', form).forEach(el => (el.style.display = 'none'));
      success.hidden = false;
      success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /* =========================================================
     INIT
     ========================================================= */
  updateIndicator();

  // Click anywhere on the cover (besides the button) to open
  $('.page--cover')?.addEventListener('click', (e) => {
    if (e.target.closest('.cover__open')) return;
    if (e.target.closest('.page__corner')) return;
    openBook();
  });

})();
