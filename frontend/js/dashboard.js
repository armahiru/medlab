/**
 * MediChain — Medical chain dashboard (admin operations)
 */
document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.requireAuth('Admin')) return;

  UI.renderHeader('dashboard');
  UI.renderSidebar('dashboard');

  let blocks = [];
  let sortColumn = 'index';
  let sortAsc = true;
  let integrityRan = false;

  const tableBody = document.getElementById('chain-table-body');
  const blockGrid = document.getElementById('block-grid');
  const integrityBtn = document.getElementById('integrity-check-btn');
  const repairBtn = document.getElementById('repair-btn');
  const tamperBtn = document.getElementById('tamper-btn');
  const tamperModal = document.getElementById('tamper-modal');
  const tamperSelect = document.getElementById('tamper-block-select');
  const tamperConfirmBtn = document.getElementById('tamper-confirm-btn');
  const tamperCancelBtn = document.getElementById('tamper-cancel-btn');
  const viewToggle = document.getElementById('view-toggle');

  integrityBtn.addEventListener('click', runIntegrityCheck);
  if (repairBtn) repairBtn.addEventListener('click', repairIntegrity);
  if (tamperBtn) tamperBtn.addEventListener('click', openTamperModal);
  if (tamperCancelBtn) tamperCancelBtn.addEventListener('click', () => UI.toggleModal('tamper-modal', false));
  if (tamperConfirmBtn) tamperConfirmBtn.addEventListener('click', confirmTamper);

  if (tamperModal) {
    tamperModal.addEventListener('click', (e) => {
      if (e.target === tamperModal) UI.toggleModal('tamper-modal', false);
    });
  }

  if (viewToggle) {
    viewToggle.addEventListener('change', () => renderBlocks());
  }

  document.querySelectorAll('.data-table th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (sortColumn === col) {
        sortAsc = !sortAsc;
      } else {
        sortColumn = col;
        sortAsc = true;
      }
      renderTable();
    });
  });

  loadChain().then(() => runIntegrityCheck());

  function getBlockTitle(block) {
    if (block.index === 0) return 'Genesis Block';
    const title = block.data?.title || block.data?.reportTitle || 'Medical report';
    const patient = block.data?.patientName || block.data?.patientId;
    return patient ? `${title} — ${patient}` : title;
  }

  function getReportType(block) {
    if (block.index === 0) return '—';
    return block.data?.reportType || block.data?.type || '—';
  }

  function getDisplayStatus(block) {
    if (block.status === 'tampered' || block.status === 'valid') return block.status;
    return integrityRan ? (block.status || 'valid') : 'pending';
  }

  async function loadChain() {
    UI.showLoading(true);
    try {
      const data = await Api.getChain();
      blocks = data.blocks || data.chain || data || [];
      if (!Array.isArray(blocks)) blocks = [];

      integrityRan = false;
      blocks = blocks.map((b) => ({ ...b, status: undefined }));

      updateStats(blocks);
      renderBlocks();
    } catch (err) {
      UI.showNotification('notification-area', 'error', 'Failed to load chain', err.message);
      tableBody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state__title">Unable to load medical chain</div><p>Ensure the MediChain backend is running on port 5000.</p></div></td></tr>`;
    } finally {
      UI.showLoading(false);
    }
  }

  async function runIntegrityCheck() {
    UI.showLoading(true);
    UI.clearNotifications('notification-area');

    try {
      const result = await Api.validateChain();
      const validated = result.blocks || result;
      integrityRan = true;

      blocks = blocks.map((block) => {
        const check = Array.isArray(validated)
          ? validated.find((v) => v.index === block.index)
          : null;
        return { ...block, status: check ? check.status : 'unknown' };
      });

      const tamperedCount = Array.isArray(validated)
        ? validated.filter((b) => b.status === 'tampered').length
        : 0;
      const isValid = result.isValid !== undefined ? result.isValid : tamperedCount === 0;

      updateStats(blocks, isValid, tamperedCount);
      renderBlocks();

      if (isValid) {
        UI.showNotification(
          'notification-area',
          'success',
          'Chain integrity verified',
          'All sealed medical reports match their hashes.'
        );
      } else {
        UI.showNotification(
          'notification-area',
          'error',
          'Integrity failure',
          `${tamperedCount} sealed report(s) no longer match. Use Repair Integrity if this was a lab alteration.`
        );
      }
    } catch (err) {
      UI.showNotification('notification-area', 'error', 'Integrity check failed', err.message);
    } finally {
      UI.showLoading(false);
    }
  }

  async function repairIntegrity() {
    UI.showLoading(true);
    UI.clearNotifications('notification-area');
    try {
      const result = await Api.repairChain();
      await loadChain();

      integrityRan = true;
      const validated = result.blocks || [];
      blocks = blocks.map((block) => {
        const check = Array.isArray(validated)
          ? validated.find((v) => v.index === block.index)
          : null;
        return { ...block, status: check ? check.status : block.status };
      });

      const tamperedCount = Array.isArray(validated)
        ? validated.filter((b) => b.status === 'tampered').length
        : 0;
      updateStats(blocks, result.isValid, tamperedCount);
      renderBlocks();

      UI.showNotification(
        'notification-area',
        result.isValid ? 'success' : 'warning',
        result.isValid ? 'Integrity restored' : 'Partial repair',
        result.message
      );
    } catch (err) {
      UI.showNotification('notification-area', 'error', 'Repair failed', err.message);
    } finally {
      UI.showLoading(false);
    }
  }

  function openTamperModal() {
    tamperSelect.innerHTML = blocks
      .filter((b) => b.index > 0)
      .map((b) => {
        const label = UI.escapeHtml(getBlockTitle(b));
        return `<option value="${b.index}">#${b.index} — ${label}</option>`;
      })
      .join('');

    if (!tamperSelect.options.length) {
      tamperSelect.innerHTML = '<option value="">No medical report blocks available</option>';
      tamperConfirmBtn.disabled = true;
    } else {
      tamperConfirmBtn.disabled = false;
    }

    UI.toggleModal('tamper-modal', true);
  }

  async function confirmTamper() {
    const blockIndex = tamperSelect.value;
    if (!blockIndex) return;

    UI.toggleModal('tamper-modal', false);
    UI.showLoading(true);

    try {
      await Api.tamperBlock(blockIndex);
      UI.showNotification(
        'notification-area',
        'warning',
        'Sealed block altered',
        `Block #${blockIndex} was changed without updating its hash. Integrity Check will flag it; Repair Integrity can restore lab alterations.`
      );
      await loadChain();
      await runIntegrityCheck();
    } catch (err) {
      UI.showNotification('notification-area', 'error', 'Alteration failed', err.message);
    } finally {
      UI.showLoading(false);
    }
  }

  function updateStats(blocksList, isValid, tamperedCount) {
    document.getElementById('stat-total').textContent = blocksList.length;

    const validEl = document.getElementById('stat-valid');
    const tamperedEl = document.getElementById('stat-tampered');
    const statusEl = document.getElementById('stat-chain-status');

    if (!integrityRan) {
      validEl.textContent = '—';
      validEl.className = 'stat-card__value';
      tamperedEl.textContent = '—';
      tamperedEl.className = 'stat-card__value';
      statusEl.textContent = 'Checking…';
      statusEl.className = 'stat-card__value';
      if (repairBtn) repairBtn.hidden = true;
      return;
    }

    const tampered =
      tamperedCount !== undefined
        ? tamperedCount
        : blocksList.filter((b) => b.status === 'tampered').length;
    const valid = Math.max(0, blocksList.filter((b) => b.index > 0).length - tampered);

    validEl.textContent = String(valid);
    validEl.className = 'stat-card__value' + (isValid ? ' stat-card__value--success' : '');
    tamperedEl.textContent = String(tampered);
    tamperedEl.className = 'stat-card__value' + (tampered > 0 ? ' stat-card__value--error' : '');

    if (isValid) {
      statusEl.textContent = 'Healthy';
      statusEl.className = 'stat-card__value stat-card__value--success';
      if (repairBtn) repairBtn.hidden = true;
    } else {
      statusEl.textContent = 'Integrity failure';
      statusEl.className = 'stat-card__value stat-card__value--error';
      if (repairBtn) repairBtn.hidden = false;
    }
  }

  function getSortedBlocks() {
    return [...blocks].sort((a, b) => {
      let aVal;
      let bVal;
      switch (sortColumn) {
        case 'timestamp':
          aVal = new Date(a.timestamp).getTime();
          bVal = new Date(b.timestamp).getTime();
          break;
        case 'title':
          aVal = getBlockTitle(a).toLowerCase();
          bVal = getBlockTitle(b).toLowerCase();
          break;
        case 'type':
          aVal = getReportType(a).toLowerCase();
          bVal = getReportType(b).toLowerCase();
          break;
        case 'hash':
          aVal = a.hash || '';
          bVal = b.hash || '';
          break;
        default:
          aVal = a.index;
          bVal = b.index;
      }
      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
  }

  function renderBlocks() {
    const view = viewToggle ? viewToggle.value : 'table';
    const tableView = document.getElementById('table-view');
    const gridView = document.getElementById('grid-view');

    if (view === 'grid') {
      if (tableView) tableView.hidden = true;
      if (gridView) gridView.hidden = false;
      renderGrid();
    } else {
      if (tableView) tableView.hidden = false;
      if (gridView) gridView.hidden = true;
      renderTable();
    }
    renderMobileCards();
  }

  function renderMobileCards() {
    const mobileList = document.getElementById('chain-mobile-list');
    if (!mobileList) return;

    const sorted = getSortedBlocks();
    if (!sorted.length) {
      mobileList.innerHTML = `<div class="empty-state"><div class="empty-state__title">No sealed reports yet</div></div>`;
      return;
    }

    mobileList.innerHTML = sorted
      .map((block) => {
        const status = getDisplayStatus(block);
        return `
          <article class="chain-card ${status === 'tampered' ? 'chain-card--tampered' : ''}">
            <div class="chain-card__top">
              <span class="chain-card__index">Block #${block.index}</span>
              ${UI.statusTag(status)}
            </div>
            <h3 class="chain-card__title">${UI.escapeHtml(getBlockTitle(block))}</h3>
            <dl class="chain-card__meta">
              <div><dt>Type</dt><dd>${UI.escapeHtml(getReportType(block))}</dd></div>
              <div><dt>Sealed</dt><dd>${UI.formatTimestamp(block.timestamp)}</dd></div>
            </dl>
            <div class="chain-card__hash" title="${UI.escapeHtml(block.hash || '')}">${UI.escapeHtml(UI.truncateHash(block.hash, 20))}</div>
          </article>
        `;
      })
      .join('');
  }

  function renderTable() {
    const sorted = getSortedBlocks();

    if (!sorted.length) {
      tableBody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state__title">No medical reports sealed yet</div><p>Have a clinical uploader seal a report to create the first block after genesis.</p></div></td></tr>`;
      return;
    }

    tableBody.innerHTML = sorted
      .map((block) => {
        const status = getDisplayStatus(block);
        const title = UI.escapeHtml(getBlockTitle(block));
        const type = UI.escapeHtml(getReportType(block));

        return `
        <tr class="${status === 'tampered' ? 'row--tampered' : ''}">
          <td>${block.index}</td>
          <td>${UI.formatTimestamp(block.timestamp)}</td>
          <td>${title}</td>
          <td>${type}</td>
          <td class="hash-cell" title="${UI.escapeHtml(block.hash || '')}">${UI.escapeHtml(UI.truncateHash(block.hash, 16))}</td>
          <td class="hash-cell" title="${UI.escapeHtml(block.previousHash || '')}">${UI.escapeHtml(UI.truncateHash(block.previousHash, 16))}</td>
          <td>${UI.statusTag(status)}</td>
        </tr>
      `;
      })
      .join('');
  }

  function renderGrid() {
    const sorted = getSortedBlocks();

    if (!sorted.length) {
      blockGrid.innerHTML = `<div class="empty-state"><div class="empty-state__title">No medical reports sealed yet</div></div>`;
      return;
    }

    blockGrid.innerHTML = sorted
      .map((block) => {
        const status = getDisplayStatus(block);
        const title = UI.escapeHtml(getBlockTitle(block));
        const type = UI.escapeHtml(getReportType(block));
        const cardClass = status === 'tampered' ? 'block-card--tampered' : '';

        return `
        <div class="block-card ${cardClass}">
          <div class="block-card__index">Block #${block.index} · ${UI.formatTimestamp(block.timestamp)}</div>
          <div class="block-card__title">${title}</div>
          <div class="block-card__type">${type}</div>
          <div class="block-card__hash">${UI.escapeHtml(UI.truncateHash(block.hash, 24))}</div>
          <div class="block-card__status">${UI.statusTag(status)}</div>
        </div>
      `;
      })
      .join('');
  }
});
