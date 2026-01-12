document.addEventListener('DOMContentLoaded', () => {
  const classLabel = document.getElementById('current-class');
  const heroWeek = document.getElementById('hero-week');
  const classTrigger = document.getElementById('class-trigger');
  const classPanel = document.getElementById('class-panel');
  const classOptions = document.getElementById('class-options');
  const classSearch = document.getElementById('class-search');
  const classStatus = document.getElementById('class-status');
  const createBtn = document.getElementById('create-class-btn');
  const newClassInput = document.getElementById('new-class-name');
  const newPasswordInput = document.getElementById('new-class-password');
  const statusEl = document.getElementById('create-class-status');
  const adminPassword = document.getElementById('admin-password');
  const adminStatus = document.getElementById('admin-status');
  const adminStatusOverlay = document.getElementById('admin-status-overlay');
  const adminOverlay = document.getElementById('admin-overlay');
  const adminBody = document.querySelector('.admin-body');
  const openAdminBtn = document.getElementById('open-admin');
  const cancelAdminPasswordBtn = document.getElementById('cancel-admin-password');
  const savePasswordBtn = document.getElementById('save-password');
  const changePasswordBtn = document.getElementById('change-password');
  const clearPasswordBtn = document.getElementById('clear-password');
  const toggleEditBtn = document.getElementById('toggle-edit');
  const editBaseDate = document.getElementById('edit-base-date');
  const editBaseWeek = document.getElementById('edit-base-week');
  const saveBaseBtn = document.getElementById('save-base-info');
  const baseModal = document.getElementById('base-modal');
  const closeBaseModalBtns = [
    document.getElementById('close-base-modal'),
    document.getElementById('close-base-modal-2'),
  ];
  const heroWeekTrigger = document.getElementById('hero-week-trigger');
  const weekEditBtn = document.getElementById('week-edit-btn');
  const weekNavButtons = document.querySelectorAll('.week-nav [data-dir]');
  const weekMessage = document.getElementById('week-message');
  const modal = document.getElementById('class-modal');
  const openModalBtn = document.getElementById('open-create-class');
  const closeModalBtns = [
    document.getElementById('close-class-modal'),
    document.getElementById('close-class-modal-2'),
  ];
  const subjectModal = document.getElementById('subject-modal');
  const closeSubjectBtns = [
    document.getElementById('close-subject-modal'),
    document.getElementById('cancel-subject-modal'),
  ];
  const subjectSlotLabel = document.getElementById('subject-slot-label');
  const subjectEntries = document.getElementById('subject-entries');
  const addSubjectEntryBtn = document.getElementById('add-subject-entry');
  const saveSubjectsBtn = document.getElementById('save-subjects');
  const subjectStatus = document.getElementById('subject-status');
  const placeholder = '--';
  const urlParams = new URLSearchParams(window.location.search);
  const initialClassId = urlParams.get('class');
  let classes = [];
  let selectedClassId = '';
  let currentClassDetail = null;
  let adminExpanded = false;
  let weekOffset = 0;
  let computedWeek = null;
  let currentSlot = { day: null, isMorning: null };
  let scheduleMap = {};
  let removedSubjectIds = [];

  // Nhận diện điện thoại để cố định giao diện mobile ngay cả khi xoay ngang
  const ua = navigator.userAgent || '';
  const isPhone =
    /Mobi|Android.*Mobile|iPhone|iPod/i.test(ua) && !/iPad|Tablet/i.test(ua);
  if (isPhone) {
    document.body.classList.add('mobile-mode');
  }

  const toggleDayDots = () => {
    const dots = document.querySelectorAll('.day-card .day-dot');
    if (!dots.length) return;
    const isActive = localStorage.getItem(editKey()) === 'on';
    dots.forEach((dot) => {
      if (isActive) dot.classList.add('show');
      else dot.classList.remove('show');
    });
  };

  const resetSubjectStatus = (msg = '', isError = false) => {
    if (subjectStatus) {
      subjectStatus.textContent = msg;
      subjectStatus.style.color = isError ? '#f97316' : '#67e8f9';
    }
  };

  const closeSubjectModal = () => {
    if (subjectModal) subjectModal.classList.remove('show');
    currentSlot = { day: null, isMorning: null };
    removedSubjectIds = [];
    resetSubjectStatus('');
    if (subjectEntries) subjectEntries.innerHTML = '';
  };

  const setRowCaret = (row) => {
    const caret = row?.querySelector('.subject-row-caret');
    if (!caret) return;
    caret.textContent = row.classList.contains('collapsed') ? '▸' : '▾';
  };

  const createSubjectRow = (defaults = {}, collapsed = false) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'subject-row-wrapper';

    const row = document.createElement('div');
    row.className = 'subject-row';
    if (defaults.id) row.dataset.id = defaults.id;
    const title =
      (defaults.subject_name || 'Lịch mới') +
      (defaults.start_week ? ` · Tuần ${defaults.start_week}` : '');
    if (collapsed) row.classList.add('collapsed');
    row.innerHTML = `
      <div class="subject-row-header">
        <div class="subject-row-title">${title}</div>
        <span class="subject-row-caret">${collapsed ? '▸' : '▾'}</span>
      </div>
      <div class="subject-row-body">
        <div>
          <input type="text" name="subject_name" placeholder="Tên môn học" value="${defaults.subject_name || ''}">
          <small>Bắt buộc</small>
        </div>
        <div>
          <input type="text" name="teacher" placeholder="Giáo viên" value="${defaults.teacher || ''}">
        </div>
        <div>
          <input type="text" name="room" placeholder="Phòng học" value="${defaults.room || ''}">
        </div>
        <div>
          <input type="number" name="start_week" min="1" placeholder="Tuần bắt đầu" value="${defaults.start_week || ''}">
        </div>
        <div>
          <input type="number" name="end_week" min="1" placeholder="Tuần kết thúc" value="${defaults.end_week || ''}">
        </div>
        <div>
          <input type="text" name="off_weeks" placeholder="Off weeks (vd: 22,23)" value="${defaults.off_weeks || ''}">
        </div>
      </div>
    `;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-entry danger standalone';
    removeBtn.setAttribute('aria-label', 'Xóa');
    removeBtn.textContent = '🗑';

    wrapper.appendChild(row);
    wrapper.appendChild(removeBtn);
    return { wrapper, row };
  };

  const ensureSubjectRows = () => {
    if (!subjectEntries) return;
    const wrappers = subjectEntries.querySelectorAll('.subject-row-wrapper');
    wrappers.forEach((wrap) => {
      const removeBtn = wrap.querySelector('.remove-entry');
      if (removeBtn) removeBtn.style.display = 'inline-flex';
    });
  };

  const addSubjectRow = (defaults = {}, collapsed = false) => {
    if (!subjectEntries) return;
    const { wrapper, row } = createSubjectRow(defaults, collapsed);
    setRowCaret(row);
    subjectEntries.appendChild(wrapper);
    ensureSubjectRows();
    return row;
  };

  const getCurrentWeekNumber = () =>
    computedWeek === null || computedWeek === undefined
      ? null
      : computedWeek + weekOffset;

  const loadSlotEntries = async (day, isMorning) => {
    const week = getCurrentWeekNumber();
    const params = new URLSearchParams({
      day: String(day),
      is_morning: isMorning ? '1' : '0',
    });
    if (week) params.append('week', String(week));
    const res = await fetch(
      `/api/classes/${selectedClassId}/subjects?${params.toString()}`
    );
    if (!res.ok) {
      const errPayload = await res.json().catch(() => ({}));
      throw new Error(errPayload.error || 'Không tải được lịch');
    }
    const payload = await res.json();
    return payload.data || [];
  };

  const openSubjectModal = async (day, isMorning) => {
    if (!subjectModal || !subjectEntries) return;
    currentSlot = { day, isMorning };
    subjectEntries.innerHTML = '';
    removedSubjectIds = [];

    if (subjectSlotLabel) {
      const buoi = isMorning ? 'Sáng' : 'Chiều';
      subjectSlotLabel.textContent = `Lịch · ${buoi} · Thứ ${day}`;
    }
    resetSubjectStatus('Đang tải lịch...');
    try {
      const existingList = await loadSlotEntries(day, isMorning);
      if (existingList.length) {
        existingList.forEach((item) => {
          addSubjectRow({
            id: item.id,
            subject_name: item.subject_name,
            teacher: item.teacher,
            room: item.room,
            start_week: item.start_week,
            end_week: item.end_week,
            off_weeks: item.off_weeks,
          }, true);
        });
      }
    } catch (err) {
      resetSubjectStatus(err.message || 'Không tải được lịch', true);
    }

    ensureSubjectRows();
    resetSubjectStatus('');
    subjectModal.classList.add('show');
  };
  if (heroWeek) heroWeek.textContent = placeholder;
  const toastContainer =
    document.getElementById('toast-container') ||
    (() => {
      const el = document.createElement('div');
      el.id = 'toast-container';
      el.className = 'toast-container';
      document.body.appendChild(el);
      return el;
    })();

  const showToast = (message) => {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 200);
    }, 2500);
  };

  const setClassLabel = (value) => {
    const text = value && value.trim() ? value.trim() : placeholder;
    if (classLabel) classLabel.textContent = text;
  };

  const setWeekNumber = (value) => {
    const text =
      value === undefined || value === null || value === ''
        ? placeholder
        : String(value);
    if (heroWeek) heroWeek.textContent = text;
  };

  const setStatus = (msg, isError = false) => {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.style.color = isError ? '#f97316' : '#67e8f9';
  };

  const setAdminStatus = (msg, isError = false) => {
    if (adminStatus) {
      adminStatus.textContent = msg || '';
      adminStatus.style.color = isError ? '#f97316' : '#67e8f9';
    }
    if (adminStatusOverlay) {
      adminStatusOverlay.textContent = msg || '';
      adminStatusOverlay.style.color = isError ? '#f97316' : '#67e8f9';
    }
  };

  const passwordKey = () =>
    selectedClassId ? `classPwd:${selectedClassId}` : 'classPwd:global';

  const editKey = () =>
    selectedClassId ? `classEdit:${selectedClassId}` : 'classEdit:global';

  const hideAdminControls = (opts = {}) => {
    const { collapse = true } = opts;
    if (collapse) adminExpanded = false;
    if (toggleEditBtn) toggleEditBtn.style.display = 'none';
    if (changePasswordBtn) changePasswordBtn.style.display = 'none';
    if (clearPasswordBtn) clearPasswordBtn.style.display = 'none';
    if (weekEditBtn) weekEditBtn.style.display = 'none';
    if (adminOverlay) adminOverlay.classList.remove('show');
    if (adminBody) adminBody.classList.remove('locked');
  };

  const updateOpenAdminVisibility = () => {
    if (!openAdminBtn) return;
    if (!selectedClassId) {
      openAdminBtn.style.display = 'none';
      return;
    }
    openAdminBtn.style.display = adminExpanded ? 'none' : 'inline-flex';
  };

  const setUrlClass = (id) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('class', id);
    else url.searchParams.delete('class');
    window.history.replaceState({}, '', url);
  };

  const closeAdminOverlay = (opts = {}) => {
    const { collapse = false } = opts;
    if (adminOverlay) adminOverlay.classList.remove('show');
    if (adminBody) adminBody.classList.remove('locked');
    if (adminPassword) adminPassword.value = '';
    setAdminStatus('');
    if (collapse) {
      hideAdminControls();
      updateOpenAdminVisibility();
    } else {
      refreshPasswordState();
    }
  };

  const updateEditButton = () => {
    if (!toggleEditBtn) return;
    let state = localStorage.getItem(editKey());
    if (state !== 'on' && state !== 'off') {
      state = 'off';
      localStorage.setItem(editKey(), 'off');
    }
    const isActive = state === 'on';
    toggleEditBtn.textContent = isActive ? 'Edit: ON' : 'Edit: OFF';
    toggleEditBtn.classList.toggle('active', isActive);
    if (weekEditBtn) {
      weekEditBtn.style.display =
        isActive && selectedClassId && adminExpanded ? 'inline-flex' : 'none';
    }
    toggleDayDots();
  };

  const refreshPasswordState = () => {
    if (!toggleEditBtn) return;
    const currentClass = classes.find(
      (c) => String(c.uid) === String(selectedClassId)
    );

    if (!currentClass) {
      hideAdminControls();
      setAdminStatus('', false);
      if (adminPassword) adminPassword.value = '';
      updateOpenAdminVisibility();
      return;
    }

    const requiresPwd = !!currentClass.has_password;
    const pwd = localStorage.getItem(passwordKey());
    if (localStorage.getItem(editKey()) !== 'off' && localStorage.getItem(editKey()) !== 'on') {
      localStorage.setItem(editKey(), 'off');
    }

    if (!adminExpanded) {
      hideAdminControls();
      updateOpenAdminVisibility();
      return;
    }

    if (!requiresPwd) {
      if (toggleEditBtn) {
        toggleEditBtn.style.display = 'inline-flex';
        toggleEditBtn.disabled = false;
      }
      setAdminStatus('');
      if (changePasswordBtn) changePasswordBtn.style.display = 'none';
      if (clearPasswordBtn) clearPasswordBtn.style.display = 'none';
      updateEditButton();
      updateOpenAdminVisibility();
      return;
    }

    if (toggleEditBtn) {
      toggleEditBtn.style.display = 'inline-flex';
    }
    const hasPwdSaved = pwd !== null && pwd !== undefined && pwd !== '';
    if (!hasPwdSaved) {
      hideAdminControls({ collapse: false });
      if (adminOverlay) adminOverlay.classList.add('show');
      if (adminBody) adminBody.classList.add('locked');
      updateOpenAdminVisibility();
      return;
    }

    if (toggleEditBtn) toggleEditBtn.disabled = false;
    setAdminStatus('');
    if (changePasswordBtn) changePasswordBtn.style.display = 'inline-flex';
    if (clearPasswordBtn) clearPasswordBtn.style.display = 'inline-flex';
    updateEditButton();
    updateOpenAdminVisibility();
  };

  const openModal = () => {
    if (modal) modal.classList.add('show');
    setStatus('');
  };

  const closeModal = () => {
    if (modal) modal.classList.remove('show');
    if (newClassInput) newClassInput.value = '';
    if (newPasswordInput) newPasswordInput.value = '';
    setStatus('');
  };

  const openBaseModal = () => {
    if (!selectedClassId) {
      return;
    }
    const isEditOn = localStorage.getItem(editKey()) === 'on';
    if (!isEditOn) {
      return;
    }
    if (baseModal) baseModal.classList.add('show');
  };

  const closeBaseModal = () => {
    if (baseModal) baseModal.classList.remove('show');
  };

  const renderOptions = (keyword = '') => {
    if (!classOptions) return;
    const q = keyword.trim().toLowerCase();
    const filtered = classes.filter((c) =>
      c.class_name.toLowerCase().includes(q)
    );
    if (!filtered.length) {
      classOptions.innerHTML =
        '<div class="class-option empty">Không có lớp</div>';
      return;
    }
    classOptions.innerHTML = filtered
      .map(
        (row) => `<div class="class-option${row.uid === selectedClassId ? ' active' : ''}" data-id="${row.uid}" data-name="${row.class_name}">
          ${row.class_name}
        </div>`
      )
      .join('');
  };

  const setTriggerLabel = (text) => {
    if (classTrigger) classTrigger.textContent = text || 'Chọn lớp';
  };

  const closePanel = () => {
    if (classPanel && classPanel.classList.contains('open')) {
      classPanel.classList.remove('open');
      if (classTrigger) classTrigger.setAttribute('aria-expanded', 'false');
    }
  };

  const openPanel = () => {
    if (classPanel) classPanel.classList.add('open');
    if (classTrigger) classTrigger.setAttribute('aria-expanded', 'true');
  };

  const selectClass = async (id, opts = {}) => {
    const { skipUrlUpdate = false } = opts;
    const found = classes.find((c) => String(c.uid) === String(id));
    if (!found) return false;
    selectedClassId = found.uid;
    weekOffset = 0;
    const name = found.class_name || '';
    setTriggerLabel(name);
    localStorage.setItem(editKey(), 'off');
    adminExpanded = false;
    try {
      await fetchClassDetail(selectedClassId);
      setClassLabel(name);
      refreshPasswordState();
      renderOptions(classSearch?.value || '');
      if (!skipUrlUpdate) setUrlClass(selectedClassId);
      return true;
    } catch (err) {
      setAdminStatus(err.message || 'Không tải được thông tin lớp', true);
      return false;
    } finally {
      closePanel();
      closeBaseModal();
      updateOpenAdminVisibility();
      toggleDayDots();
    }
  };

  const loadClasses = async () => {
    try {
      const res = await fetch('/api/classes');
      if (!res.ok) throw new Error('Không tải được danh sách lớp');
      const payload = await res.json();
      classes = payload.data || [];
      renderOptions(classSearch?.value || '');
      if (!selectedClassId) {
        setTriggerLabel('Chọn lớp');
        setClassLabel('');
        setWeekNumber('');
        computedWeek = null;
      }
      if (classStatus) classStatus.textContent = '';
    } catch (err) {
      console.error(err);
      if (classStatus) classStatus.textContent = 'Không tải được danh sách lớp';
    }
  };

  const fetchClassDetail = async (id) => {
    const res = await fetch(`/api/classes/${id}`);
    if (!res.ok) throw new Error('Không tải được thông tin lớp');
    const payload = await res.json();
    currentClassDetail = payload.data;
    setClassLabel(currentClassDetail.class_name || '');
    if (editBaseDate) editBaseDate.value = currentClassDetail.base_date || '';
    if (editBaseWeek)
      editBaseWeek.value = currentClassDetail.base_week
        ? String(currentClassDetail.base_week)
        : '';
    updateDisplayedWeek();
  };

  const updateDisplayedWeek = () => {
    if (!currentClassDetail) {
      setWeekNumber('');
      computedWeek = null;
      return;
    }
    const { base_date: baseDate, base_week: baseWeek } = currentClassDetail;
    if (!baseDate || !baseWeek) {
      setWeekNumber('');
      computedWeek = null;
      return;
    }
    const current = new Date();
    const base = new Date(baseDate);
    if (Number.isNaN(base.getTime())) {
      setWeekNumber('');
      computedWeek = null;
      return;
    }
    const dayMs = 24 * 60 * 60 * 1000;
    const baseNoon = new Date(base.getTime());
    baseNoon.setHours(12, 0, 0, 0);
    const nowNoon = new Date(current.getTime());
    nowNoon.setHours(12, 0, 0, 0);
    const diffWeeks = Math.floor((nowNoon - baseNoon) / dayMs / 7);
    computedWeek = Number(baseWeek) + diffWeeks;
    setWeekNumber(computedWeek + weekOffset);
    loadSchedule();
  };

  const renderEmptySchedule = () => {
    scheduleMap = {};
    const sessions = document.querySelectorAll('.session');
    sessions.forEach((slot) => {
      slot.classList.add('empty');
      slot.classList.remove('filled');
      slot.innerHTML = 'Chưa có lịch';
      slot.dataset.subjectId = '';
    });
    const dayCards = document.querySelectorAll('.day-card');
    dayCards.forEach((card) => card.classList.add('mobile-empty'));
    if (weekMessage) weekMessage.textContent = 'Tuần này không có lịch.';
  };

  const renderSchedule = (rows = []) => {
    const sessions = document.querySelectorAll('.session');
    const map = {};
    rows.forEach((row) => {
      const key = `${row.day_of_week}-${row.is_morning}`;
      if (!map[key]) {
        map[key] = { current: null, upcoming: null };
      }
      if (row.upcoming) {
        if (!map[key].upcoming) map[key].upcoming = row;
      } else {
        if (!map[key].current) map[key].current = row;
      }
    });
    scheduleMap = map;

    sessions.forEach((slot) => {
      const day = Number(slot.dataset.day);
      const isMorning = Number(slot.dataset.morning);
      const key = `${day}-${isMorning}`;
      const data = map[key]?.current || null;
      const fallback = map[key]?.upcoming || null;

      if (data) {
        slot.classList.remove('empty');
        slot.classList.add('filled');
        slot.dataset.subjectId = data.id || '';
        const meta = [];
        if (data.teacher) meta.push(`GV: ${data.teacher}`);
        if (data.room) meta.push(`Phòng: ${data.room}`);
        slot.innerHTML = `
          <div class="subject-name">${data.subject_name}</div>
          <div class="subject-meta">${meta.join('<br>') || ' '}</div>
        `;
        slot.classList.remove('fade-out');
        slot.classList.add('fade-in');
      } else {
        slot.classList.add('empty');
        slot.classList.remove('filled');
        slot.innerHTML = 'Chưa có lịch';
        slot.dataset.subjectId = fallback?.id || '';
        slot.classList.remove('fade-in');
        slot.classList.add('fade-out');
      }
    });

    const dayCards = document.querySelectorAll('.day-card');
    let hasCurrent = false;
    dayCards.forEach((card) => {
      const slots = card.querySelectorAll('.session');
      const filled = Array.from(slots).some((slot) =>
        slot.classList.contains('filled')
      );
      if (filled) {
        card.classList.remove('mobile-empty');
        hasCurrent = true;
      } else {
        card.classList.add('mobile-empty');
      }
    });
    if (weekMessage) {
      weekMessage.textContent = hasCurrent ? '' : 'Tuần này không có lịch.';
    }
  };

  const loadSchedule = async () => {
    const week = getCurrentWeekNumber();
    if (!selectedClassId || !week) {
      renderEmptySchedule();
      return;
    }
    try {
      const res = await fetch(
        `/api/classes/${selectedClassId}/subjects?week=${week}&include_upcoming=1`
      );
      if (!res.ok) throw new Error('Không tải được thời khóa biểu');
      const payload = await res.json();
      renderSchedule(payload.data || []);
    } catch (err) {
      console.error(err);
      renderEmptySchedule();
    }
  };

  const createClass = async () => {
    if (!newClassInput || !newPasswordInput) return;
    const className = newClassInput.value.trim();
    const password = newPasswordInput.value;
    if (!className) {
      setStatus('Nhập tên lớp trước', true);
      return;
    }
    setStatus('Đang tạo lớp...');
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_name: className, password }),
      });
      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        throw new Error(errPayload.error || 'Tạo lớp thất bại');
      }
      newClassInput.value = '';
      newPasswordInput.value = '';
      setStatus('Tạo lớp thành công');
      closeModal();
      showToast('Tạo lịch học thành công');
      await loadClasses();
      const created = classes.find((c) => c.class_name === className);
      if (created) {
        await selectClass(created.uid);
      }
    } catch (err) {
      console.error(err);
      setStatus(err.message || 'Tạo lớp thất bại', true);
    }
  };

  if (classTrigger && classPanel) {
    classTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      const isOpen = classPanel.classList.contains('open');
      if (isOpen) {
        closePanel();
      } else {
        openPanel();
      }
    });
  }

  if (classOptions) {
    classOptions.addEventListener('click', async (e) => {
      const option = e.target.closest('.class-option');
      if (!option || option.classList.contains('empty')) return;
      await selectClass(option.dataset.id);
    });
  }

  if (classSearch) {
    classSearch.addEventListener('input', (e) => {
      renderOptions(e.target.value);
    });
  }

  if (createBtn) {
    createBtn.addEventListener('click', (e) => {
      e.preventDefault();
      createClass();
    });
  }

  if (openModalBtn) {
    openModalBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
  }

  if (openAdminBtn) {
    openAdminBtn.addEventListener('click', (e) => {
      e.preventDefault();
      adminExpanded = true;
      refreshPasswordState();
    });
  }

  closeModalBtns.forEach((btn) => {
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        closeModal();
      });
    }
  });

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  if (baseModal) {
    baseModal.addEventListener('click', (e) => {
      if (e.target === baseModal) {
        closeBaseModal();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeBaseModal();
      if (adminOverlay && adminOverlay.classList.contains('show')) {
        const currentClass = classes.find(
          (c) => String(c.uid) === String(selectedClassId)
        );
        const requiresPwd = !!currentClass?.has_password;
        const hasPwdSaved = !!localStorage.getItem(passwordKey());
        closeAdminOverlay({ collapse: requiresPwd && !hasPwdSaved });
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (
      classPanel &&
      classTrigger &&
      !classPanel.contains(e.target) &&
      !classTrigger.contains(e.target)
    ) {
      closePanel();
    }
  });

  closeBaseModalBtns.forEach((btn) => {
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        closeBaseModal();
      });
    }
  });

  const verifyPassword = async (classId, pwd) => {
    const res = await fetch(`/api/classes/${classId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd }),
    });
    if (res.ok) return true;
    const errPayload = await res.json().catch(() => ({}));
    throw new Error(errPayload.error || 'Xác minh mật khẩu thất bại');
  };

  if (savePasswordBtn) {
    savePasswordBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!adminPassword) return;
      const pwd = adminPassword.value.trim();
      if (!selectedClassId) {
        return;
      }
      const currentClass = classes.find(
        (c) => String(c.uid) === String(selectedClassId)
      );
      const requiresPwd = currentClass?.has_password;

      if (!requiresPwd) {
        localStorage.removeItem(passwordKey());
        localStorage.setItem(editKey(), 'off');
        setAdminStatus('');
        refreshPasswordState();
        return;
      }

      if (!pwd) {
        setAdminStatus('Nhập mật khẩu để xác nhận', true);
        return;
      }

      try {
        await verifyPassword(selectedClassId, pwd);
        localStorage.setItem(passwordKey(), pwd);
        localStorage.setItem(editKey(), 'off');
        setAdminStatus('Đã lưu mật khẩu');
        closeAdminOverlay();
      } catch (err) {
        setAdminStatus(err.message || 'Mật khẩu không đúng', true);
      }
    });
  }

  if (cancelAdminPasswordBtn) {
    cancelAdminPasswordBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const currentClass = classes.find(
        (c) => String(c.uid) === String(selectedClassId)
      );
      const requiresPwd = !!currentClass?.has_password;
      const hasPwdSaved = !!localStorage.getItem(passwordKey());
      closeAdminOverlay({ collapse: requiresPwd && !hasPwdSaved });
    });
  }

  if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!selectedClassId) {
        return;
      }
      if (adminOverlay) adminOverlay.classList.add('show');
      if (adminBody) adminBody.classList.add('locked');
      if (adminPassword) {
        adminPassword.value = '';
        adminPassword.focus();
      }
      setAdminStatus('Nhập mật khẩu mới', false);
    });
  }

  if (clearPasswordBtn) {
    clearPasswordBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!selectedClassId) {
        return;
      }
      localStorage.removeItem(passwordKey());
      localStorage.setItem(editKey(), 'off');
      setAdminStatus('Đã xóa mật khẩu lưu trữ');
      refreshPasswordState();
    });
  }

  if (saveBaseBtn) {
    saveBaseBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!selectedClassId) {
        return;
      }
      const baseDate = editBaseDate?.value || '';
      const baseWeek = Number(editBaseWeek?.value || 0);
      const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!isoRegex.test(baseDate)) {
        setAdminStatus('Ngày mốc không hợp lệ (YYYY-MM-DD)', true);
        return;
      }
      if (!Number.isInteger(baseWeek) || baseWeek < 1) {
        setAdminStatus('Tuần mốc phải >= 1', true);
        return;
      }
      try {
        const res = await fetch(`/api/classes/${selectedClassId}/base`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base_date: baseDate, base_week: baseWeek }),
        });
        if (!res.ok) {
          const errPayload = await res.json().catch(() => ({}));
          throw new Error(errPayload.error || 'Cập nhật thất bại');
        }
        currentClassDetail = {
          ...(currentClassDetail || {}),
          base_date: baseDate,
          base_week: baseWeek,
        };
        weekOffset = 0;
        setAdminStatus('Đã lưu tuần mốc');
        updateDisplayedWeek();
        closeBaseModal();
      } catch (err) {
        setAdminStatus(err.message || 'Cập nhật thất bại', true);
      }
    });
  }

  if (toggleEditBtn) {
    toggleEditBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!selectedClassId) {
        return;
      }
      const hasPwd = localStorage.getItem(passwordKey());
      const isActive = localStorage.getItem(editKey()) === 'on';
      if (isActive) {
        localStorage.setItem(editKey(), 'off');
        setAdminStatus('');
      } else {
        const currentClass = classes.find(
          (c) => String(c.uid) === String(selectedClassId)
        );
        const requiresPwd = currentClass?.has_password;
        if (requiresPwd && !hasPwd) {
          setAdminStatus('Cần nhập mật khẩu để bật edit', true);
          return;
        }
        localStorage.setItem(editKey(), 'on');
        setAdminStatus('');
      }
      updateEditButton();
    });
  }

  if (heroWeekTrigger) {
    heroWeekTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      openBaseModal();
    });
  }

  if (weekEditBtn) {
    weekEditBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openBaseModal();
    });
  }

  if (weekNavButtons && weekNavButtons.length) {
    weekNavButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!currentClassDetail || computedWeek === null) return;
        const dir = btn.getAttribute('data-dir');
        if (dir === 'prev') {
          weekOffset -= 1;
        } else if (dir === 'next') {
          weekOffset += 1;
        } else if (dir === 'home') {
          weekOffset = 0;
        }
        updateDisplayedWeek();
      });
    });
  }

  const sessionSlots = document.querySelectorAll('.session');
  if (sessionSlots && sessionSlots.length) {
    sessionSlots.forEach((slot) => {
      slot.addEventListener('click', (e) => {
        e.preventDefault();
        if (isPhone) {
          return; // mobile readonly
        }
        const day = Number(slot.dataset.day);
        const isMorning = slot.dataset.morning === '1';
        const key = `${day}-${isMorning ? 1 : 0}`;
        const existingSlot =
          scheduleMap[key]?.current || scheduleMap[key]?.upcoming || null;
        if (!selectedClassId) {
          showToast('Chọn lớp trước');
          return;
        }
        if (!adminExpanded) {
          showToast('Mở admin tool để chỉnh sửa lịch');
          return;
        }
        const isEditOn = localStorage.getItem(editKey()) === 'on';
        if (!isEditOn) {
          showToast('Bật edit trong admin tool để chỉnh sửa');
          return;
        }
        openSubjectModal(day, isMorning, existingSlot);
      });
    });
  }

  closeSubjectBtns.forEach((btn) => {
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        closeSubjectModal();
      });
    }
  });

  if (subjectModal) {
    subjectModal.addEventListener('click', (e) => {
      if (e.target === subjectModal) closeSubjectModal();
    });
  }

  if (addSubjectEntryBtn) {
    addSubjectEntryBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const row = addSubjectRow({ start_week: '', end_week: '' }, false);
      if (row) row.classList.remove('collapsed');
    });
  }

  if (subjectEntries) {
    subjectEntries.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-entry')) {
        e.preventDefault();
        const wrapper = e.target.closest('.subject-row-wrapper');
        const row = wrapper?.querySelector('.subject-row');
        if (row?.dataset.id) removedSubjectIds.push(row.dataset.id);
        if (wrapper) wrapper.remove();
        ensureSubjectRows();
        return;
      }

      const header = e.target.closest('.subject-row-header');
      if (header && !e.target.classList.contains('remove-entry')) {
        const row = header.closest('.subject-row');
        if (row) {
          row.classList.toggle('collapsed');
          setRowCaret(row);
        }
      }
    });
  }

  const saveSubjects = async () => {
    if (!selectedClassId || currentSlot.day === null) return;
    const isEditOn = localStorage.getItem(editKey()) === 'on';
    if (!isEditOn) {
      resetSubjectStatus('Bật edit trước khi lưu', true);
      return;
    }
    const rows = Array.from(subjectEntries?.querySelectorAll('.subject-row') || []);
    if (!rows.length && !removedSubjectIds.length) {
      resetSubjectStatus('Thêm ít nhất 1 môn hoặc xóa lịch cũ', true);
      return;
    }
    resetSubjectStatus('Đang lưu...');
    try {
      if (removedSubjectIds.length) {
        for (const sid of removedSubjectIds) {
          const res = await fetch(
            `/api/classes/${selectedClassId}/subjects/${sid}`,
            { method: 'DELETE' }
          );
          if (!res.ok) {
            const errPayload = await res.json().catch(() => ({}));
            throw new Error(errPayload.error || 'Xóa lịch thất bại');
          }
        }
      }

      if (!rows.length) {
        resetSubjectStatus('Đã xóa lịch');
        closeSubjectModal();
        await loadSchedule();
        showToast('Đã xóa lịch học');
        return;
      }

      for (const row of rows) {
        const subjectId = row.dataset.id || '';
        const subjectName =
          row.querySelector('input[name=\"subject_name\"]')?.value.trim() || '';
        const teacher = row.querySelector('input[name=\"teacher\"]')?.value.trim() || '';
        const room = row.querySelector('input[name=\"room\"]')?.value.trim() || '';
        const startWeek = Number(
          row.querySelector('input[name=\"start_week\"]')?.value || 0
        );
        const endWeek = Number(row.querySelector('input[name=\"end_week\"]')?.value || 0);
        const offWeeks =
          row.querySelector('input[name=\"off_weeks\"]')?.value.trim() || '';

        if (!subjectName) {
          resetSubjectStatus('Tên môn học là bắt buộc', true);
          return;
        }
        if (!Number.isInteger(startWeek) || startWeek < 1) {
          resetSubjectStatus('Tuần bắt đầu phải >= 1', true);
          return;
        }
        if (!Number.isInteger(endWeek) || endWeek < startWeek) {
          resetSubjectStatus('Tuần kết thúc phải >= tuần bắt đầu', true);
          return;
        }

        const payload = {
          subject_name: subjectName,
          teacher,
          room,
          start_week: startWeek,
          end_week: endWeek,
          day_of_week: currentSlot.day,
          is_morning: currentSlot.isMorning ? 1 : 0,
          off_weeks: offWeeks,
        };

        const url = subjectId
          ? `/api/classes/${selectedClassId}/subjects/${subjectId}`
          : `/api/classes/${selectedClassId}/subjects`;
        const method = subjectId ? 'PATCH' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errPayload = await res.json().catch(() => ({}));
          throw new Error(errPayload.error || 'Lưu lịch thất bại');
        }
      }
      resetSubjectStatus('Đã lưu lịch');
      closeSubjectModal();
      await loadSchedule();
      showToast('Đã thêm lịch học');
    } catch (err) {
      resetSubjectStatus(err.message || 'Lưu lịch thất bại', true);
    }
  };

  if (saveSubjectsBtn) {
    saveSubjectsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      saveSubjects();
    });
  }

  const initialLoad = async () => {
    setClassLabel('');
    setWeekNumber('');
    await loadClasses();
    if (initialClassId) {
      const ok = await selectClass(initialClassId, { skipUrlUpdate: true });
      if (!ok) {
        setUrlClass('');
        refreshPasswordState();
        updateOpenAdminVisibility();
      }
    } else {
      refreshPasswordState();
      updateOpenAdminVisibility();
    }
  };

  setClassLabel('');
  setWeekNumber('');
  initialLoad();
});
