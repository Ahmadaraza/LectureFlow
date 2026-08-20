/* ============================================================
   LectureFlow — Vanilla JS timetable planner
   ============================================================ */

(function () {
  'use strict';

  const STORAGE_KEY = 'lectureflow_timetable_v1';

  /* ---------- Element references ---------- */
  const $ = (id) => document.getElementById(id);
  const screens = {
    home: $('home-screen'),
    setup: $('setup-screen'),
    result: $('result-screen'),
    schedule: $('schedule-screen'),
    settings: $('settings-screen'),
  };
  const navItems = document.querySelectorAll('.nav-item');

  /* ---------- App state ---------- */
  let savedData = null;   // last generated timetable payload

  /* ============================================================
     NAVIGATION
     ============================================================ */
  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    if (screens[name]) screens[name].classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setActiveNav(name) {
    navItems.forEach((n) => n.classList.toggle('active', n.dataset.screen === name));
  }

  function navigateTo(name) {
    // Refresh schedule screen content when visited
    if (name === 'schedule') renderScheduleScreen();
    showScreen(name);
    setActiveNav(name);
  }

  navItems.forEach((item) => {
    item.addEventListener('click', () => navigateTo(item.dataset.screen));
  });

  /* ============================================================
     SETUP SCREEN OPEN / CLOSE
     ============================================================ */
  function openSetupScreen() {
    showScreen('setup');
    setActiveNav('home');
  }

  function closeSetupScreen() {
    showScreen('home');
    setActiveNav('home');
  }

  $('open-setup-btn').addEventListener('click', openSetupScreen);
  $('setup-back').addEventListener('click', closeSetupScreen);
  $('result-back').addEventListener('click', () => navigateTo('home'));
  $('schedule-create-btn').addEventListener('click', openSetupScreen);

  /* ============================================================
     SUBJECT INPUTS — dynamically generated
     ============================================================ */
  function generateSubjectInputs() {
    const count = clampInt($('num-subjects').value, 1, 20, 1);
    const list = $('subject-list');
    list.innerHTML = '';

    // Preserve existing values where possible
    const existing = collectSubjectValues();

    for (let i = 0; i < count; i++) {
      const wrap = document.createElement('div');
      wrap.className = 'subject-item';

      const head = document.createElement('div');
      head.className = 'subject-item-head';
      const num = document.createElement('span');
      num.className = 'subject-num';
      num.textContent = 'Subject ' + (i + 1);
      head.appendChild(num);

      const fields = document.createElement('div');
      fields.className = 'subject-fields';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.placeholder = 'Subject name';
      nameInput.maxLength = 40;
      nameInput.setAttribute('aria-label', 'Subject ' + (i + 1) + ' name');
      nameInput.dataset.role = 'name';
      const prevName = existing[i] ? existing[i].name : '';
      if (prevName) nameInput.value = prevName;

      const lecInput = document.createElement('input');
      lecInput.type = 'number';
      lecInput.min = '1';
      lecInput.max = '20';
      lecInput.placeholder = '1';
      lecInput.setAttribute('aria-label', 'Subject ' + (i + 1) + ' lectures');
      lecInput.dataset.role = 'lectures';
      const prevLec = existing[i] && existing[i].lectures ? existing[i].lectures : '';
      if (prevLec) lecInput.value = prevLec;

      fields.appendChild(nameInput);
      fields.appendChild(lecInput);

      wrap.appendChild(head);
      wrap.appendChild(fields);
      list.appendChild(wrap);
    }

    updateAllocationCounter();
  }

  function collectSubjectValues() {
    const items = document.querySelectorAll('.subject-item');
    const out = [];
    items.forEach((it) => {
      const name = it.querySelector('[data-role="name"]');
      const lec = it.querySelector('[data-role="lectures"]');
      out.push({
        name: name ? name.value.trim() : '',
        lectures: lec ? parseInt(lec.value, 10) || 0 : 0,
      });
    });
    return out;
  }

  /* ---------- Live allocation counter ---------- */
  function updateAllocationCounter() {
    const total = clampInt($('num-lectures').value, 1, 20, 1);
    const values = collectSubjectValues();
    const allocated = values.reduce((s, v) => s + (v.lectures || 0), 0);

    $('alloc-total').textContent = total;
    $('alloc-current').textContent = allocated;

    const counter = $('allocation-counter');
    counter.classList.remove('ok', 'under', 'over');
    if (allocated === total) counter.classList.add('ok');
    else if (allocated < total) counter.classList.add('under');
    else counter.classList.add('over');
  }

  /* ---------- Event wiring for live updates ---------- */
  $('num-subjects').addEventListener('input', generateSubjectInputs);
  $('num-lectures').addEventListener('input', updateAllocationCounter);
  $('subject-list').addEventListener('input', updateAllocationCounter);

  /* ============================================================
     VALIDATION
     ============================================================ */
  function showValidation(msg) {
    const el = $('validation-msg');
    if (msg) {
      el.textContent = msg;
      el.classList.add('show');
    } else {
      el.classList.remove('show');
    }
  }

  function validateForm() {
    const start = $('start-time').value;
    const end = $('end-time').value;
    const numLec = parseInt($('num-lectures').value, 10);
    const numSub = parseInt($('num-subjects').value, 10);
    const breakDur = parseInt($('break-duration').value, 10);
    const subjects = collectSubjectValues();

    if (!start) return 'Please enter a college start time.';
    if (!end) return 'Please enter a college end time.';
    if (timeToMinutes(start) >= timeToMinutes(end))
      return 'College end time must be later than the start time.';
    if (!numLec || numLec < 1) return 'Number of lectures must be greater than 0.';
    if (numLec > 20) return 'Number of lectures cannot exceed 20.';
    if (!numSub || numSub < 1) return 'Number of subjects must be greater than 0.';
    if (numSub > 20) return 'Number of subjects cannot exceed 20.';

    const missingNames = subjects.some((s) => !s.name);
    if (missingNames) return 'Please enter all subject names.';
    const zeroLec = subjects.some((s) => !s.lectures || s.lectures < 1);
    if (zeroLec) return 'Every subject must have at least 1 lecture.';

    const allocated = subjects.reduce((s, v) => s + v.lectures, 0);
    if (allocated !== numLec)
      return 'Your subjects have ' + allocated + ' allocated lectures, but your timetable has ' + numLec + ' lectures.';

    if (isNaN(breakDur) || breakDur < 0) return 'Break duration cannot be negative.';
    if (breakDur > 120) return 'Break duration cannot exceed 120 minutes.';

    // Time feasibility check
    const totalMin = timeToMinutes(end) - timeToMinutes(start);
    const teachMin = totalMin - breakDur;
    if (teachMin <= 0)
      return 'The break is too long — there is no teaching time left.';
    const perLec = teachMin / numLec;
    if (perLec < 1)
      return 'There is not enough time for ' + numLec + ' lectures within the college hours.';

    return null;
  }

  /* ============================================================
     TIME HELPERS
     ============================================================ */
  function timeToMinutes(t) {
    if (!t) return 0;
    const parts = t.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  function minutesToTime(m) {
    m = ((m % 1440) + 1440) % 1440;
    let h = Math.floor(m / 60);
    const min = m % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return h + ':' + String(min).padStart(2, '0') + ' ' + ampm;
  }

  function formatDuration(minutes) {
    minutes = Math.round(minutes);
    if (minutes < 60) return minutes + 'm';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0) return h + 'h';
    return h + 'h ' + m + 'm';
  }

  function clampInt(val, min, max, fallback) {
    let n = parseInt(val, 10);
    if (isNaN(n)) n = fallback;
    if (n < min) n = min;
    if (n > max) n = max;
    return n;
  }

  /* ============================================================
     TIMETABLE CALCULATION
     ============================================================ */
  function calculateLectureDuration(totalMin, breakDur, numLec) {
    const teachMin = totalMin - breakDur;
    return teachMin / numLec;
  }

  function calculateBreakPosition(numLec) {
    // Place break roughly in the middle, between lectures.
    // For even lecture counts -> after half. For odd -> after ceil(n/2).
    return Math.ceil(numLec / 2);
  }

  /* ---------- Better subject distribution ---------- */
  function distributeSubjects(subjects) {
    // Build a flat list of subject "tokens", then space repeated
    // subjects apart using a round-robin style interleaving.
    // subjects: [{name, lectures}]
    const pool = [];
    subjects.forEach((s) => {
      for (let i = 0; i < s.lectures; i++) pool.push(s.name);
    });

    // Group identical subjects
    const groups = {};
    subjects.forEach((s) => {
      if (!groups[s.name]) groups[s.name] = [];
      for (let i = 0; i < s.lectures; i++) groups[s.name].push(s.name);
    });

    // Sort groups by size descending so larger groups get placed first
    const groupKeys = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);

    const total = pool.length;
    const result = new Array(total).fill(null);

    // Place subjects in alternating slots to avoid back-to-back
    let idx = 0;
    groupKeys.forEach((key) => {
      const items = groups[key];
      // Spread each group's items across the result with a stride
      let placed = 0;
      let step = 0;
      while (placed < items.length) {
        let pos = (idx + step) % total;
        if (result[pos] === null) {
          result[pos] = items[placed];
          placed++;
        }
        step++;
        if (step > total * 2) break; // safety
      }
      idx += Math.ceil(total / items.length);
    });

    // Fill any remaining nulls (shouldn't happen, but safety)
    let fallback = 0;
    for (let i = 0; i < result.length; i++) {
      if (result[i] === null) {
        result[i] = pool[fallback % pool.length];
        fallback++;
      }
    }

    // Final pass: swap any unavoidable adjacent duplicates if possible
    for (let i = 1; i < result.length; i++) {
      if (result[i] === result[i - 1]) {
        // find a later different item to swap
        for (let j = i + 1; j < result.length; j++) {
          if (result[j] !== result[i] && (i === 0 || result[j] !== result[i - 1])) {
            const tmp = result[i];
            result[i] = result[j];
            result[j] = tmp;
            break;
          }
        }
      }
    }

    return result;
  }

  function calculateTimetable(input) {
    const startMin = timeToMinutes(input.startTime);
    const endMin = timeToMinutes(input.endTime);
    const totalMin = endMin - startMin;
    const breakDur = input.breakDuration;
    const numLec = input.totalLectures;

    // Distribute lecture durations so the timetable ends exactly at end time.
    // Use a base integer duration, then distribute the remainder seconds across
    // the first few lectures so the schedule always ends precisely.
    const teachMin = totalMin - breakDur;
    const base = Math.floor(teachMin / numLec);        // integer minutes
    let remainder = teachMin - base * numLec;          // leftover minutes

    // Per-lecture minute durations
    const durations = [];
    for (let i = 0; i < numLec; i++) {
      let d = base;
      if (remainder > 0) { d += 1; remainder -= 1; }
      durations.push(d);
    }

    const breakPos = calculateBreakPosition(numLec);
    const order = distributeSubjects(input.subjects);

    // Build the timeline
    const items = [];
    let cursor = startMin;
    let lecIndex = 0;

    for (let slot = 0; slot < numLec; slot++) {
      // Insert break before this lecture if it's the break position
      if (slot === breakPos) {
        const bStart = cursor;
        const bEnd = cursor + breakDur;
        items.push({ type: 'break', start: bStart, end: bEnd, duration: breakDur });
        cursor = bEnd;
      }
      const dur = durations[lecIndex];
      const s = cursor;
      const e = cursor + dur;
      items.push({
        type: 'lecture',
        index: lecIndex + 1,
        name: order[lecIndex],
        start: s,
        end: e,
        duration: dur,
      });
      cursor = e;
      lecIndex++;
    }

    // Effective (average) lecture duration for display
    const avgLecture = Math.round(teachMin / numLec);

    return {
      startTime: input.startTime,
      endTime: input.endTime,
      totalLectures: numLec,
      subjects: input.subjects,
      breakDuration: breakDur,
      totalDuration: totalMin,
      teachingDuration: teachMin,
      lectureDuration: avgLecture,
      breakPosition: breakPos,
      items: items,
      endExactMin: endMin,
    };
  }

  /* ============================================================
     RENDER TIMETABLE
     ============================================================ */
  function escapeText(str) {
    // Safe text insertion helper
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderTimetable(container, data) {
    container.innerHTML = '';

    data.items.forEach((item) => {
      if (item.type === 'break') {
        const row = document.createElement('div');
        row.className = 'break-row';

        const emoji = document.createElement('span');
        emoji.className = 'break-emoji';
        emoji.textContent = '☕';

        const info = document.createElement('div');
        info.className = 'break-info';
        const name = document.createElement('div');
        name.className = 'break-name';
        name.textContent = 'Break';
        const time = document.createElement('div');
        time.className = 'break-time';
        time.textContent = minutesToTime(item.start) + ' - ' + minutesToTime(item.end);
        info.appendChild(name);
        info.appendChild(time);

        const dur = document.createElement('span');
        dur.className = 'break-dur';
        dur.textContent = formatDuration(item.duration);

        row.appendChild(emoji);
        row.appendChild(info);
        row.appendChild(dur);
        container.appendChild(row);
      } else {
        const row = document.createElement('div');
        row.className = 'lecture-row';

        const badge = document.createElement('div');
        badge.className = 'lecture-badge';
        badge.textContent = String(item.index).padStart(2, '0');

        const info = document.createElement('div');
        info.className = 'lecture-info';
        const nm = document.createElement('div');
        nm.className = 'lecture-name';
        nm.textContent = item.name; // textContent = safe
        const tm = document.createElement('div');
        tm.className = 'lecture-time';
        tm.textContent = minutesToTime(item.start) + ' - ' + minutesToTime(item.end);
        info.appendChild(nm);
        info.appendChild(tm);

        const dur = document.createElement('span');
        dur.className = 'lecture-dur';
        dur.textContent = formatDuration(item.duration);

        row.appendChild(badge);
        row.appendChild(info);
        row.appendChild(dur);
        container.appendChild(row);
      }
    });

    // College ends row
    const ends = document.createElement('div');
    ends.className = 'ends-row';
    const dot = document.createElement('span');
    dot.className = 'ends-dot';
    const txt = document.createElement('span');
    txt.className = 'ends-text';
    txt.textContent = 'College Ends';
    const t = document.createElement('span');
    t.className = 'ends-time';
    t.textContent = minutesToTime(data.endExactMin);
    ends.appendChild(dot);
    ends.appendChild(txt);
    ends.appendChild(t);
    container.appendChild(ends);
  }

  /* ============================================================
     UPDATE HOME STATS
     ============================================================ */
  function updateHomeStats(data) {
    if (!data) {
      // defaults already in HTML
      return;
    }
    $('home-start').textContent = minutesToTime(timeToMinutes(data.startTime));
    $('home-end').textContent = minutesToTime(timeToMinutes(data.endTime));
    $('home-lectures').textContent = data.totalLectures;
    $('home-each').textContent = formatDuration(data.lectureDuration);
    $('home-break').textContent = formatDuration(data.breakDuration);
    $('overview-duration').textContent = formatDuration(data.totalDuration);
    $('overview-subjects').textContent = data.subjects.length;
  }

  /* ============================================================
     SAVE / LOAD / CLEAR (localStorage)
     ============================================================ */
  function saveTimetable(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      savedData = data;
    } catch (e) {
      // storage may be unavailable; ignore
    }
  }

  function loadTimetable() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clearTimetable() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    savedData = null;
    // Reset home stats to defaults
    $('home-start').textContent = '7:40 AM';
    $('home-end').textContent = '1:30 PM';
    $('home-lectures').textContent = '6';
    $('home-each').textContent = '55m';
    $('home-break').textContent = '20m';
    $('overview-duration').textContent = '5h 50m';
    $('overview-subjects').textContent = '6';
    renderScheduleScreen();
    showToast('Saved timetable cleared.');
  }

  /* ============================================================
     SCHEDULE SCREEN
     ============================================================ */
  function renderScheduleScreen() {
    const data = savedData || loadTimetable();
    if (data) savedData = data;
    const empty = $('schedule-empty');
    const content = $('schedule-content');

    if (!data) {
      empty.classList.remove('hidden');
      content.classList.add('hidden');
      return;
    }
    empty.classList.add('hidden');
    content.classList.remove('hidden');

    $('sched-sum-duration').textContent = formatDuration(data.totalDuration);
    $('sched-sum-each').textContent = formatDuration(data.lectureDuration);
    $('sched-sum-subjects').textContent = data.subjects.length;
    $('sched-sum-break').textContent = formatDuration(data.breakDuration);
    $('sched-tt-count').textContent = data.totalLectures + ' Lectures';
    renderTimetable($('sched-timetable-list'), data);
  }

  /* ============================================================
     RESULT SCREEN RENDER
     ============================================================ */
  function renderResultScreen(data) {
    $('sum-duration').textContent = formatDuration(data.totalDuration);
    $('sum-each').textContent = formatDuration(data.lectureDuration);
    $('sum-subjects').textContent = data.subjects.length;
    $('sum-break').textContent = formatDuration(data.breakDuration);
    $('tt-count').textContent = data.totalLectures + ' Lectures';
    renderTimetable($('timetable-list'), data);
  }

  /* ============================================================
     FORM SUBMIT -> GENERATE
     ============================================================ */
  function buildInputFromForm() {
    return {
      startTime: $('start-time').value,
      endTime: $('end-time').value,
      totalLectures: parseInt($('num-lectures').value, 10),
      subjects: collectSubjectValues().map((s) => ({
        name: s.name,
        lectures: s.lectures,
      })),
      breakDuration: parseInt($('break-duration').value, 10),
    };
  }

  $('setup-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const err = validateForm();
    if (err) {
      showValidation(err);
      return;
    }
    showValidation(null);

    const input = buildInputFromForm();
    const data = calculateTimetable(input);
    saveTimetable(data);
    updateHomeStats(data);
    renderResultScreen(data);
    showScreen('result');
    setActiveNav('home');
  });

  /* ============================================================
     RESULT ACTIONS
     ============================================================ */
  $('edit-btn').addEventListener('click', () => {
    // Return to setup preserving values (values already remain in the form)
    showScreen('setup');
    setActiveNav('home');
  });

  $('new-btn').addEventListener('click', () => {
    resetForm();
    showScreen('setup');
    setActiveNav('home');
    showToast('Form reset. Enter new details.');
  });

  $('copy-btn').addEventListener('click', () => {
    const data = savedData || loadTimetable();
    if (!data) {
      showToast('No timetable to copy.');
      return;
    }
    let text = 'LectureFlow — ' + minutesToTime(timeToMinutes(data.startTime)) +
      ' to ' + minutesToTime(timeToMinutes(data.endTime)) + '\n';
    data.items.forEach((it) => {
      if (it.type === 'break') {
        text += '☕ Break  ' + minutesToTime(it.start) + ' - ' + minutesToTime(it.end) + ' (' + formatDuration(it.duration) + ')\n';
      } else {
        text += String(it.index).padStart(2, '0') + '. ' + it.name + '  ' +
          minutesToTime(it.start) + ' - ' + minutesToTime(it.end) +
          ' (' + formatDuration(it.duration) + ')\n';
      }
    });
    text += 'College Ends ' + minutesToTime(data.endExactMin);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => showToast('Schedule copied to clipboard.'),
        () => fallbackCopy(text)
      );
    } else {
      fallbackCopy(text);
    }
  });

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast('Schedule copied to clipboard.');
    } catch (e) {
      showToast('Could not copy automatically.');
    }
    document.body.removeChild(ta);
  }

  /* ============================================================
     RESET FORM
     ============================================================ */
  function resetForm() {
    $('start-time').value = '07:40';
    $('end-time').value = '13:30';
    $('num-lectures').value = '6';
    $('num-subjects').value = '4';
    $('break-duration').value = '20';
    showValidation(null);
    generateSubjectInputs();
  }

  /* ============================================================
     SETTINGS
     ============================================================ */
  const clearBtn = $('clear-btn');
  const dialogOverlay = $('dialog-overlay');
  $('dialog-cancel').addEventListener('click', () => dialogOverlay.classList.add('hidden'));
  $('dialog-confirm').addEventListener('click', () => {
    clearTimetable();
    dialogOverlay.classList.add('hidden');
  });
  clearBtn.addEventListener('click', () => {
    if (savedData || loadTimetable()) {
      dialogOverlay.classList.remove('hidden');
    } else {
      showToast('No saved timetable to clear.');
    }
  });

  const aboutOverlay = $('about-overlay');
  $('about-btn').addEventListener('click', () => aboutOverlay.classList.remove('hidden'));
  $('about-close').addEventListener('click', () => aboutOverlay.classList.add('hidden'));

  // Close dialogs on overlay click
  [dialogOverlay, aboutOverlay].forEach((ov) => {
    ov.addEventListener('click', (e) => {
      if (e.target === ov) ov.classList.add('hidden');
    });
  });

  /* ============================================================
     TOAST
     ============================================================ */
  let toastTimer = null;
  function showToast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
  }

  /* ============================================================
     INIT
     ============================================================ */
  function init() {
    generateSubjectInputs();

    // Restore saved timetable if present
    const data = loadTimetable();
    if (data) {
      savedData = data;
      updateHomeStats(data);
    }
  }

  init();
})();
