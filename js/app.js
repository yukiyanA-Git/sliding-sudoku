/**
 * スライド数独 メインアプリケーションコントローラー
 */
function initApp() {
  // 状態変数
  let board = null;
  let audio = new SoundEffects();
  let currentDifficulty = 'normal';
  let timerInterval = null;
  let gameStartTime = 0;
  let elapsedSeconds = 0;
  let selectedNumber = null;
  let isConflictHintActive = false;
  let isPreviewMode = false;
  let hintUsedInCurrentGame = false;
  let lastSubmittedEntryId = null;
  let currentRankingFilter = {
    period: 'all',
    difficulty: 'normal',
    noHintOnly: false
  };

  // DOM要素
  const boardContainer = document.getElementById('board-container');
  const timerVal = document.getElementById('timer-val');
  const movesVal = document.getElementById('moves-val');
  const conflictsVal = document.getElementById('conflicts-val');
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  const hintBtn = document.getElementById('hint-btn');
  const previewBtn = document.getElementById('preview-btn');
  const resetBtn = document.getElementById('reset-btn');
  const newGameBtn = document.getElementById('new-game-btn');
  const soundBtn = document.getElementById('sound-btn');
  const helpBtn = document.getElementById('help-btn');
  const rankingBtn = document.getElementById('ranking-btn');
  const diffBtns = document.querySelectorAll('.diff-btn');

  const helpModal = document.getElementById('help-modal');
  const winModal = document.getElementById('win-modal');
  const winTime = document.getElementById('win-time');
  const winMoves = document.getElementById('win-moves');
  const winDiffText = document.getElementById('win-diff-text');
  const winHintBadge = document.getElementById('win-hint-badge');
  const playerNameInput = document.getElementById('player-name-input');
  const submitRankingBtn = document.getElementById('submit-ranking-btn');
  const rankingRegisterStatus = document.getElementById('ranking-register-status');
  const winViewRankingBtn = document.getElementById('win-view-ranking-btn');
  const winNextBtn = document.getElementById('win-next-btn');

  const rankingModal = document.getElementById('ranking-modal');
  const rankingTbody = document.getElementById('ranking-tbody');
  const rankingEmptyMsg = document.getElementById('ranking-empty-msg');
  const rankingLoadingMsg = document.getElementById('ranking-loading-msg');
  const rankTabBtns = document.querySelectorAll('.rank-tab-btn');
  const rankDiffBtns = document.querySelectorAll('.rank-diff-btn');
  const rankingNoHintChk = document.getElementById('ranking-no-hint-chk');

  const confettiCanvas = document.getElementById('confetti-canvas');

  // タイルDOM要素のキャッシュ (id -> HTMLElement)
  const tileElements = new Map();

  function showToast(msg) {
    let toast = document.getElementById('game-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'game-toast';
      toast.className = 'game-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2200);
  }

  /**
   * ゲーム初期化
   */
  function startNewGame(difficulty = currentDifficulty, notify = false) {
    currentDifficulty = difficulty;
    board = new SlidingBoard(difficulty);
    selectedNumber = null;
    isConflictHintActive = false;
    hintUsedInCurrentGame = false;
    lastSubmittedEntryId = null;
    if (rankingRegisterStatus) {
      rankingRegisterStatus.textContent = '';
      rankingRegisterStatus.className = 'register-status';
    }
    if (submitRankingBtn) {
      submitRankingBtn.disabled = false;
      submitRankingBtn.innerHTML = '<span>登録</span>';
    }
    stopTimer();
    startTimer();

    buildBoardDOM();
    updateDifficultyRestrictions();
    updateUI();

    if (boardContainer) {
      boardContainer.classList.remove('board-refresh');
      void boardContainer.offsetWidth; // 強制リフロー
      boardContainer.classList.add('board-refresh');
    }

    if (notify) {
      showToast(`🎲 新しい問題を開始しました（${board.difficulty.name}）`);
    }
  }

  /**
   * 盤面のDOM構造を初期生成
   */
  function buildBoardDOM() {
    boardContainer.innerHTML = '';
    tileElements.clear();

    // 9個の 3x3 ブロック要素を生成
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const blockEl = document.createElement('div');
        blockEl.className = 'sudoku-block';
        blockEl.dataset.br = br;
        blockEl.dataset.bc = bc;

        // 背景スロット (空きマスの溝デザイン)
        const slotGrid = document.createElement('div');
        slotGrid.className = 'slot-bg-grid';
        for (let i = 0; i < 9; i++) {
          const slot = document.createElement('div');
          slot.className = 'slot-bg';
          const sr = br * 3 + Math.floor(i / 3);
          const sc = bc * 3 + (i % 3);
          slot.dataset.r = sr;
          slot.dataset.c = sc;
          slot.addEventListener('click', onEmptySlotClick);
          slotGrid.appendChild(slot);
        }
        blockEl.appendChild(slotGrid);

        // タイルレイヤー
        const tilesLayer = document.createElement('div');
        tilesLayer.className = 'tiles-layer';

        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const gr = br * 3 + r;
            const gc = bc * 3 + c;
            const cell = board.grid[gr][gc];

            if (cell.type !== 'empty') {
              const tileEl = createTileElement(cell, r, c);
              tilesLayer.appendChild(tileEl);
              tileElements.set(cell.id, tileEl);
            }
          }
        }

        blockEl.appendChild(tilesLayer);
        boardContainer.appendChild(blockEl);
      }
    }
  }

  /**
   * 空きマスをクリックしたとき、隣接する可動タイルがあればそのマスへ引き込む
   */
  function onEmptySlotClick(e) {
    if (board.isCompleted || isPreviewMode) return;
    const slotEl = e.currentTarget;
    const sr = parseInt(slotEl.dataset.r, 10);
    const sc = parseInt(slotEl.dataset.c, 10);
    if (isNaN(sr) || isNaN(sc)) return;

    const cell = board.grid[sr][sc];
    if (cell.type !== 'empty') return;

    const br = Math.floor(sr / 3);
    const bc = Math.floor(sc / 3);

    const dirs = [
      { r: sr - 1, c: sc, dir: 'down' },
      { r: sr + 1, c: sc, dir: 'up' },
      { r: sr, c: sc - 1, dir: 'right' },
      { r: sr, c: sc + 1, dir: 'left' }
    ];

    for (const d of dirs) {
      if (Math.floor(d.r / 3) === br && Math.floor(d.c / 3) === bc) {
        const neighbor = board.grid[d.r][d.c];
        if (neighbor && neighbor.type === 'movable') {
          const success = board.slideTile(d.r, d.c, d.dir);
          if (success) {
            audio.playSlide();
            syncTilePositions();
            updateUI();
            if (board.isCompleted) onGameWon();
            return;
          }
        }
      }
    }
  }

  /**
   * 個別タイルDOM要素を作成
   */
  function createTileElement(cell, localR, localC) {
    const el = document.createElement('div');
    el.className = `tile tile-${cell.type}`;
    el.dataset.id = cell.id;
    el.dataset.r = cell.r;
    el.dataset.c = cell.c;
    el.textContent = cell.val;

    // 位置設定 (33.333% グリッド)
    el.style.left = `calc(${localC * 33.3333}% + 2px)`;
    el.style.top = `calc(${localR * 33.3333}% + 2px)`;

    // マウスドラッグ・スワイプ・クリック統合ポインターイベント（DOM自身の現在座標を直接参照）
    el.addEventListener('pointerdown', onTilePointerDown);

    return el;
  }

  // ドラッグ操作の状態管理
  let activeDrag = null;
  let toastEl = null;
  let toastTimeout = null;

  /**
   * 画面下部に案内トーストメッセージを表示
   */
  function showToast(message, duration = 2400) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'game-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add('visible');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      if (toastEl) toastEl.classList.remove('visible');
    }, duration);
  }

  /**
   * 指定セルが属する3x3ブロック内の「空きマス」をパルス発光させて場所をガイド
   */
  function highlightBlockEmptySlots(r, c) {
    const br = Math.floor(r / 3);
    const bc = Math.floor(c / 3);
    const blockEl = boardContainer.querySelector(`.sudoku-block[data-br="${br}"][data-bc="${bc}"]`);
    if (!blockEl) return;

    const slots = blockEl.querySelectorAll('.slot-bg');
    slots.forEach(slot => {
      const sr = parseInt(slot.dataset.r, 10);
      const sc = parseInt(slot.dataset.c, 10);
      if (!isNaN(sr) && !isNaN(sc) && board.grid[sr][sc].type === 'empty') {
        slot.classList.remove('pulse-empty');
        void slot.offsetWidth; // リフロー発生でアニメーションリセット
        slot.classList.add('pulse-empty');
        setTimeout(() => slot.classList.remove('pulse-empty'), 1300);
      }
    });
  }

  function onTilePointerDown(e) {
    if (e.button !== 0 || board.isCompleted || isPreviewMode) return;

    const tileEl = e.currentTarget || e.target.closest('.tile');
    if (!tileEl) return;

    // クリックされたタイルDOMの最新の現在座標を取得
    let targetR = parseInt(tileEl.dataset.r, 10);
    let targetC = parseInt(tileEl.dataset.c, 10);

    // 万が一 dataset.r/c が未設定または無効な場合のID逆引きフォールバック
    if (isNaN(targetR) || isNaN(targetC) || targetR < 0 || targetC < 0) {
      const tid = tileEl.dataset.id;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (board.grid[r][c].id === tid) {
            targetR = r;
            targetC = c;
            break;
          }
        }
        if (!isNaN(targetR) && targetR >= 0) break;
      }
    }

    if (isNaN(targetR) || isNaN(targetC) || targetR < 0 || targetC < 0) return;

    const targetCell = board.grid[targetR][targetC];
    if (!targetCell) return;
    const tileId = targetCell.id;

    // 固定数字（動かせない数字）をクリック・ドラッグしようとした場合
    if (targetCell.type === 'fixed') {
      audio.playBlocked();
      triggerShake(tileEl);
      toggleNumberHighlight(targetCell.val);
      showToast('🔒 斜体枠付きの数字は固定数字です（移動できません）', 1800);
      return;
    }

    // 移動可能な4方向オプションを取得
    const options = board.getAvailableSlideOptions(targetR, targetC);
    const canMoveLeft = Boolean(options.left);
    const canMoveRight = Boolean(options.right);
    const canMoveUp = Boolean(options.up);
    const canMoveDown = Boolean(options.down);
    const canSlide = canMoveLeft || canMoveRight || canMoveUp || canMoveDown;

    activeDrag = {
      tileId,
      tileEl,
      targetR,
      targetC,
      targetCell,
      canSlide,
      canMoveLeft,
      canMoveRight,
      canMoveUp,
      canMoveDown,
      startX: e.clientX,
      startY: e.clientY,
      tileSize: tileEl.offsetWidth,
      isDragging: false,
      chosenDir: null, // 'left' | 'right' | 'up' | 'down'
      currentDx: 0,
      currentDy: 0,
      pointerId: e.pointerId
    };

    try {
      tileEl.setPointerCapture(e.pointerId);
    } catch (_) {}

    const onPointerMove = (ev) => {
      if (!activeDrag || activeDrag.pointerId !== ev.pointerId) return;

      const rawDx = ev.clientX - activeDrag.startX;
      const rawDy = ev.clientY - activeDrag.startY;

      if (!activeDrag.isDragging && Math.hypot(rawDx, rawDy) > 4) {
        activeDrag.isDragging = true;
        activeDrag.tileEl.classList.add('grabbing');
      }

      if (!activeDrag.isDragging) return;

      if (!activeDrag.canSlide) {
        // 現在スライドできないタイルの場合、ドラッグには追従させない
        return;
      }

      // 水平・垂直どちらの軸を主にドラッグしているか判定
      const absDx = Math.abs(rawDx);
      const absDy = Math.abs(rawDy);
      const isHorizontal = absDx >= absDy;

      let moveX = 0;
      let moveY = 0;
      let targetDir = null;

      if (isHorizontal) {
        if (rawDx < 0 && activeDrag.canMoveLeft) {
          moveX = Math.max(rawDx, -activeDrag.tileSize);
          targetDir = 'left';
        } else if (rawDx > 0 && activeDrag.canMoveRight) {
          moveX = Math.min(rawDx, activeDrag.tileSize);
          targetDir = 'right';
        } else if (rawDy < 0 && activeDrag.canMoveUp) {
          moveY = Math.max(rawDy, -activeDrag.tileSize);
          targetDir = 'up';
        } else if (rawDy > 0 && activeDrag.canMoveDown) {
          moveY = Math.min(rawDy, activeDrag.tileSize);
          targetDir = 'down';
        }
      } else {
        if (rawDy < 0 && activeDrag.canMoveUp) {
          moveY = Math.max(rawDy, -activeDrag.tileSize);
          targetDir = 'up';
        } else if (rawDy > 0 && activeDrag.canMoveDown) {
          moveY = Math.min(rawDy, activeDrag.tileSize);
          targetDir = 'down';
        } else if (rawDx < 0 && activeDrag.canMoveLeft) {
          moveX = Math.max(rawDx, -activeDrag.tileSize);
          targetDir = 'left';
        } else if (rawDx > 0 && activeDrag.canMoveRight) {
          moveX = Math.min(rawDx, activeDrag.tileSize);
          targetDir = 'right';
        }
      }

      activeDrag.currentDx = moveX;
      activeDrag.currentDy = moveY;
      activeDrag.chosenDir = targetDir;

      activeDrag.tileEl.style.transition = 'none';
      activeDrag.tileEl.style.transform = `translate(${moveX}px, ${moveY}px)`;
      activeDrag.tileEl.style.zIndex = '25';
    };

    const onPointerUp = (ev) => {
      if (!activeDrag || activeDrag.pointerId !== ev.pointerId) return;

      const drag = activeDrag;
      activeDrag = null;

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      try {
        drag.tileEl.releasePointerCapture(ev.pointerId);
      } catch (_) {}

      drag.tileEl.classList.remove('grabbing');

      if (drag.canSlide) {
        // マウスの総移動ベクトル
        const totalDx = ev.clientX - drag.startX;
        const totalDy = ev.clientY - drag.startY;
        const movedDist = Math.max(
          Math.hypot(drag.currentDx, drag.currentDy),
          Math.hypot(totalDx, totalDy)
        );
        const threshold = drag.tileSize * 0.16; // 軽快に反応するよう感度を向上

        let finalDir = drag.chosenDir;
        if (!finalDir && movedDist >= threshold) {
          if (Math.abs(totalDx) >= Math.abs(totalDy)) {
            finalDir = totalDx < 0 ? 'left' : 'right';
          } else {
            finalDir = totalDy < 0 ? 'up' : 'down';
          }
        }

        // 十分にドラッグされたか、もしくはクリック（指を動かさずに離した）された場合
        if (movedDist >= threshold || !drag.isDragging) {
          drag.tileEl.style.transition = '';
          drag.tileEl.style.transform = '';
          drag.tileEl.style.zIndex = '';

          const success = board.slideTile(drag.targetR, drag.targetC, finalDir);
          if (success) {
            audio.playSlide();
            syncTilePositions();
            updateUI();

            if (board.isCompleted) {
              onGameWon();
            }
            return;
          }
        }

        // 閾値未満で離した場合は、バネのように元の位置へスムーズに戻す
        drag.tileEl.style.transition = 'transform 0.18s cubic-bezier(0.2, 0, 0, 1)';
        drag.tileEl.style.transform = 'translate(0px, 0px)';
        setTimeout(() => {
          drag.tileEl.style.transition = '';
          drag.tileEl.style.transform = '';
          drag.tileEl.style.zIndex = '';
        }, 180);
      } else {
        // スライドできないタイル（現在、同じ列や行に空きマスがない）
        audio.playBlocked();
        triggerShake(drag.tileEl);
        toggleNumberHighlight(drag.targetCell.val);
        highlightBlockEmptySlots(drag.targetR, drag.targetC);
        showToast('💡 空きマスがないため今は動かせません。周りを先に動かして空きマスを寄せてください', 2400);
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  function toggleNumberHighlight(num) {
    if (selectedNumber === num) {
      selectedNumber = null;
    } else {
      selectedNumber = num;
    }
    applyHighlights();
  }

  /**
   * タイルのDOM位置を盤面データと同期（スムーズなCSSスライド）
   */
  function syncTilePositions() {
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const gr = br * 3 + r;
            const gc = bc * 3 + c;
            const cell = board.grid[gr][gc];

            if (cell.type !== 'empty') {
              const tileEl = tileElements.get(cell.id);
              if (tileEl) {
                tileEl.dataset.r = gr;
                tileEl.dataset.c = gc;
                tileEl.style.left = `calc(${c * 33.3333}% + 2px)`;
                tileEl.style.top = `calc(${r * 33.3333}% + 2px)`;
              }
            }
          }
        }
      }
    }
  }

  /**
   * ハイライト（重複ヒント、選択数字、スライド可能ガイド）の更新
   */
  function applyHighlights() {
    const { conflicts, duplicateCounts } = board.getConflicts();

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = board.grid[r][c];
        if (cell.type !== 'empty') {
          const tileEl = tileElements.get(cell.id);
          if (tileEl) {
            // 重複チェック：ヒントがONのときのみ赤色ハイライト
            if (conflicts[r][c] && isConflictHintActive) {
              tileEl.classList.add('has-conflict');
            } else {
              tileEl.classList.remove('has-conflict');
            }

            // 同一数字ハイライト
            if (selectedNumber !== null && cell.val === selectedNumber) {
              tileEl.classList.add('same-number');
            } else {
              tileEl.classList.remove('same-number');
            }

            // スライド可能タイルのマーク
            const canSlide = board.getSlideMove(r, c) !== null;
            if (canSlide) {
              tileEl.classList.add('slidable');
            } else {
              tileEl.classList.remove('slidable');
            }
          }
        }
      }
    }

    // 重複カウント表示（ヒントON時のみ表示、OFF時は非表示）
    if (duplicateCounts.total === 0) {
      conflictsVal.textContent = 'なし (達成!)';
      conflictsVal.className = 'value ok';
    } else if (isConflictHintActive) {
      conflictsVal.textContent = `${duplicateCounts.total} 箇所`;
      conflictsVal.className = 'value has-conflicts';
    } else {
      conflictsVal.textContent = '非表示';
      conflictsVal.className = 'value';
    }
  }

  /**
   * UI状態（手数・ボタン活性状態など）の更新
   */
  function updateUI() {
    movesVal.textContent = board.moveCount;
    undoBtn.disabled = board.moveHistory.length === 0 || board.isCompleted;
    redoBtn.disabled = board.redoHistory.length === 0 || board.isCompleted;

    applyHighlights();
  }

  /**
   * タイマー管理
   */
  function startTimer() {
    stopTimer();
    gameStartTime = Date.now();
    elapsedSeconds = 0;
    timerInterval = setInterval(() => {
      elapsedSeconds = Math.max(1, Math.floor((Date.now() - gameStartTime) / 1000));
      const m = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
      const s = String(elapsedSeconds % 60).padStart(2, '0');
      timerVal.textContent = `${m}:${s}`;
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  /**
   * ゲーム勝利時の処理
   */
  function onGameWon() {
    stopTimer();
    audio.playVictory();
    launchConfetti();

    winTime.textContent = timerVal.textContent;
    winMoves.textContent = `${board.moveCount} 手`;
    winDiffText.textContent = `難易度: ${board.difficulty.name}`;

    if (!hintUsedInCurrentGame) {
      winHintBadge.className = 'status-badge success';
      winHintBadge.textContent = '✨ ヒントなしクリア！';
    } else {
      winHintBadge.className = 'status-badge warning';
      winHintBadge.textContent = '💡 ヒント使用あり';
    }

    // プレイヤー名の自動復元
    const savedName = localStorage.getItem('numpre_shift_player_name') || '';
    if (playerNameInput) playerNameInput.value = savedName;

    if (submitRankingBtn) {
      submitRankingBtn.disabled = false;
      submitRankingBtn.innerHTML = '<span>登録</span>';
    }
    if (rankingRegisterStatus) {
      rankingRegisterStatus.textContent = '';
      rankingRegisterStatus.className = 'register-status';
    }

    setTimeout(() => {
      winModal.classList.add('active');
    }, 600);
  }

  /**
   * 重複ヒント機能（重複箇所の赤色ハイライトON/OFF）
   */
  function toggleConflictHint() {
    if (currentDifficulty === 'master') {
      showToast('🔒 達人モードではヒント機能は使用できません');
      return;
    }
    if (board.isCompleted) return;

    isConflictHintActive = !isConflictHintActive;
    if (isConflictHintActive) {
      hintUsedInCurrentGame = true;
      audio.playHint();
      showToast('💡 重複している数字を赤色表示しました');
    } else {
      showToast('💡 重複表示をオフにしました');
    }
    updateDifficultyRestrictions();
    applyHighlights();
  }

  /**
   * 難易度に応じたアシスト機能の制限設定
   * - 上級 & 達人: ゴール表示不可
   * - 達人: ヒント機能も不可
   */
  function updateDifficultyRestrictions() {
    // 上級・達人はゴール表示不可
    if (currentDifficulty === 'hard' || currentDifficulty === 'master') {
      previewBtn.disabled = true;
      previewBtn.classList.add('disabled-lock');
      previewBtn.title = '上級・達人モードではゴール表示は使用できません';
      previewBtn.innerHTML = '<span>🔒</span> ゴール (不可)';
    } else {
      previewBtn.disabled = false;
      previewBtn.classList.remove('disabled-lock');
      previewBtn.title = '押している間、正解配置を表示';
      previewBtn.innerHTML = '<span>👁️</span> ゴール表示';
    }

    // 達人はヒント不可
    if (currentDifficulty === 'master') {
      isConflictHintActive = false;
      hintBtn.disabled = true;
      hintBtn.classList.add('disabled-lock');
      hintBtn.classList.remove('active-hint');
      hintBtn.title = '達人モードではヒント機能は使用できません';
      hintBtn.innerHTML = '<span>🔒</span> ヒント (不可)';
    } else {
      hintBtn.disabled = false;
      hintBtn.classList.remove('disabled-lock');
      hintBtn.title = '重複している数字を赤色でハイライト表示（ON/OFF）';
      hintBtn.innerHTML = isConflictHintActive ? '<span>💡</span> 重複ON' : '<span>💡</span> 重複ヒント';
      if (isConflictHintActive) {
        hintBtn.classList.add('active-hint');
      } else {
        hintBtn.classList.remove('active-hint');
      }
    }
  }

  /**
   * ゴール状態のプレビュー表示（長押し/ホバー）
   */
  function toggleGoalPreview(show) {
    if (currentDifficulty === 'hard' || currentDifficulty === 'master') {
      if (show) {
        showToast('🔒 上級・達人モードではゴール表示は使用できません');
      }
      return;
    }

    isPreviewMode = show;
    if (show) {
      hintUsedInCurrentGame = true;
      boardContainer.classList.add('preview-mode');
      // ゴール位置の値を各タイルにゴースト表示
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const goalCell = board.goalGrid[r][c];
          if (goalCell.type !== 'empty') {
            const tileEl = tileElements.get(goalCell.id);
            if (tileEl) {
              const lc = goalCell.origC % 3;
              const lr = goalCell.origR % 3;
              tileEl.style.left = `calc(${lc * 33.3333}% + 2px)`;
              tileEl.style.top = `calc(${lr * 33.3333}% + 2px)`;
              tileEl.classList.add('preview-ghost');
            }
          }
        }
      }
    } else {
      boardContainer.classList.remove('preview-mode');
      document.querySelectorAll('.preview-ghost').forEach(el => el.classList.remove('preview-ghost'));
      syncTilePositions();
    }
  }

  /**
   * リセット（初期シャッフル直後の状態に復帰）
   */
  function resetGame() {
    if (board.moveHistory.length === 0) return;
    while (board.moveHistory.length > 0) {
      board.undo();
    }
    board.redoHistory = [];
    board.moveCount = 0;
    audio.playSlide();
    syncTilePositions();
    updateUI();
  }

  /**
   * イベントリスナー設定
   */
  // 難易度切り替え
  diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      diffBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      startNewGame(btn.dataset.diff);
    });
  });

  // 操作ボタン群
  undoBtn.addEventListener('click', () => {
    if (board.undo()) {
      audio.playSlide();
      syncTilePositions();
      updateUI();
    }
  });

  redoBtn.addEventListener('click', () => {
    if (board.redo()) {
      audio.playSlide();
      syncTilePositions();
      updateUI();
      if (board.isCompleted) onGameWon();
    }
  });

  hintBtn.addEventListener('click', toggleConflictHint);
  newGameBtn.addEventListener('click', () => startNewGame(currentDifficulty, true));
  resetBtn.addEventListener('click', () => {
    resetGame();
    showToast('🔄 盤面を初期状態にリセットしました');
  });
  winNextBtn.addEventListener('click', () => {
    winModal.classList.remove('active');
    startNewGame(currentDifficulty, true);
  });

  // ランキング登録ボタン＆入力
  if (submitRankingBtn) {
    submitRankingBtn.addEventListener('click', submitRanking);
  }
  if (playerNameInput) {
    playerNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitRanking();
    });
  }

  // ランキングモーダル呼び出し
  if (rankingBtn) {
    rankingBtn.addEventListener('click', () => openRankingModal(currentDifficulty));
  }
  if (winViewRankingBtn) {
    winViewRankingBtn.addEventListener('click', () => {
      winModal.classList.remove('active');
      openRankingModal(currentDifficulty);
    });
  }

  // ランキング期間タブ切り替え
  rankTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      rankTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRankingFilter.period = btn.dataset.period;
      fetchAndRenderRanking();
    });
  });

  // ランキング難易度タブ切り替え
  rankDiffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      rankDiffBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRankingFilter.difficulty = btn.dataset.diff;
      fetchAndRenderRanking();
    });
  });

  // ヒントなし限定切り替え
  if (rankingNoHintChk) {
    rankingNoHintChk.addEventListener('change', () => {
      currentRankingFilter.noHintOnly = rankingNoHintChk.checked;
      fetchAndRenderRanking();
    });
  }

  /**
   * ランキング登録処理（Firebase Firestore または ローカルNode.js サーバー）
   */
  async function submitRanking() {
    if (submitRankingBtn.disabled) return;
    const name = (playerNameInput.value || '').trim() || '名無しパズラー';
    localStorage.setItem('numpre_shift_player_name', name);

    submitRankingBtn.disabled = true;
    submitRankingBtn.innerHTML = '<span>登録中...</span>';
    rankingRegisterStatus.textContent = '通信中...';
    rankingRegisterStatus.className = 'register-status';

    try {
      if (typeof cloudDb !== 'undefined' && cloudDb) {
        // --- Firebase Cloud Firestore 経由で登録 ---
        const docRef = await cloudDb.collection('rankings').add({
          name,
          timeSec: elapsedSeconds,
          moves: board.moveCount,
          difficulty: currentDifficulty,
          hintUsed: hintUsedInCurrentGame,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        lastSubmittedEntryId = docRef.id;

        // 同じ難易度で自分より上位の記録を数えて順位を計算（手数最優先 -> タイム -> ヒントなし）
        const snapshot = await cloudDb.collection('rankings')
          .where('difficulty', '==', currentDifficulty)
          .get();
        let rank = 1;
        snapshot.forEach(doc => {
          if (doc.id === docRef.id) return;
          const d = doc.data();
          const t = typeof d.timeSec === 'number' ? d.timeSec : 999999;
          const m = typeof d.moves === 'number' ? d.moves : 999999;
          const h = Boolean(d.hintUsed);

          // 1. 手数 (少ない方が上位)
          if (m < board.moveCount) {
            rank++;
          } else if (m === board.moveCount) {
            // 2. クリア時間 (早い方が上位)
            if (t < elapsedSeconds) {
              rank++;
            } else if (t === elapsedSeconds) {
              // 3. ヒントなし優先 (なしが上位)
              if (!h && hintUsedInCurrentGame) {
                rank++;
              }
            }
          }
        });
        const total = snapshot.size;

        submitRankingBtn.innerHTML = '<span>登録完了 ✔</span>';
        rankingRegisterStatus.textContent = `🎉 第${rank}位にランクイン！（${board.difficulty.name}・全${total}件中）`;
        audio.playVictory();
        showToast(`🏆 第${rank}位にランクインしました！`);
      } else {
        // --- ローカル Node.js サーバー経由で登録 ---
        const res = await fetch('/api/ranking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            name,
            timeSec: elapsedSeconds,
            moves: board.moveCount,
            difficulty: currentDifficulty,
            hintUsed: hintUsedInCurrentGame
          })
        });
        const data = await res.json();
        if (data.success) {
          lastSubmittedEntryId = data.entry.id;
          submitRankingBtn.innerHTML = '<span>登録完了 ✔</span>';
          rankingRegisterStatus.textContent = `🎉 第${data.rank}位にランクイン！（${board.difficulty.name}・全${data.total}件中）`;
          audio.playVictory();
          showToast(`🏆 第${data.rank}位にランクインしました！`);
        } else {
          throw new Error(data.error || '登録失敗');
        }
      }
    } catch (err) {
      console.error('Failed to submit ranking:', err);
      submitRankingBtn.disabled = false;
      submitRankingBtn.innerHTML = '<span>再試行</span>';
      rankingRegisterStatus.textContent = '⚠️ 登録に失敗しました。接続を確認してください。';
      rankingRegisterStatus.className = 'register-status error';
    }
  }

  /**
   * ランキングモーダルの表示
   */
  async function openRankingModal(preferredDiff = null) {
    if (preferredDiff) {
      currentRankingFilter.difficulty = preferredDiff;
      rankDiffBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.diff === preferredDiff);
      });
    }
    rankingModal.classList.add('active');
    await fetchAndRenderRanking();
  }

  /**
   * ランキングデータの取得＆HTML描画
   */
  async function fetchAndRenderRanking() {
    if (!rankingTbody) return;
    rankingLoadingMsg.style.display = 'block';
    rankingEmptyMsg.style.display = 'none';
    rankingTbody.innerHTML = '';

    try {
      let rankings = [];

      if (typeof cloudDb !== 'undefined' && cloudDb) {
        // --- Firebase Cloud Firestore から取得 ---
        let query = cloudDb.collection('rankings');
        if (currentRankingFilter.difficulty !== 'all') {
          query = query.where('difficulty', '==', currentRankingFilter.difficulty);
        }
        if (currentRankingFilter.noHintOnly) {
          query = query.where('hintUsed', '==', false);
        }

        const snapshot = await query.get();
        const now = Date.now();
        let thresholdTime = 0;
        if (currentRankingFilter.period === 'weekly') {
          thresholdTime = now - (7 * 24 * 60 * 60 * 1000);
        } else if (currentRankingFilter.period === 'monthly') {
          thresholdTime = now - (30 * 24 * 60 * 60 * 1000);
        }

        snapshot.forEach(doc => {
          const data = doc.data();
          const createdAtDate = data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)) : new Date();
          if (thresholdTime > 0 && createdAtDate.getTime() < thresholdTime) return;
          rankings.push({
            id: doc.id,
            name: data.name || '名無しパズラー',
            timeSec: data.timeSec || 0,
            moves: data.moves || 0,
            difficulty: data.difficulty || 'normal',
            hintUsed: Boolean(data.hintUsed),
            createdAt: createdAtDate.toISOString()
          });
        });

        // ソート: 手数昇順(最優先) -> タイム昇順(同手数の場合) -> ヒントなし優先 -> 達成日時降順
        rankings.sort((a, b) => {
          if (a.moves !== b.moves) return a.moves - b.moves; // 1. 手数が最優先
          if (a.timeSec !== b.timeSec) return a.timeSec - b.timeSec; // 2. 同手数ならクリアタイム
          if (a.hintUsed !== b.hintUsed) return (a.hintUsed ? 1 : 0) - (b.hintUsed ? 1 : 0); // 3. ヒントなし優先 (false < true)
          return new Date(b.createdAt) - new Date(a.createdAt); // 4. 日時
        });
        rankings = rankings.slice(0, 100);
      } else {
        // --- ローカル Node.js サーバーから取得 ---
        const params = new URLSearchParams({
          period: currentRankingFilter.period,
          difficulty: currentRankingFilter.difficulty,
          noHintOnly: currentRankingFilter.noHintOnly ? 'true' : 'false'
        });
        const res = await fetch(`/api/ranking?${params.toString()}`);
        const data = await res.json();
        if (data.success && data.rankings) {
          rankings = data.rankings;
        }
      }

      rankingLoadingMsg.style.display = 'none';

      if (!rankings || rankings.length === 0) {
        rankingEmptyMsg.style.display = 'block';
        return;
      }

      rankingTbody.innerHTML = rankings.map((entry, idx) => {
        const rank = idx + 1;
        let rankBadgeClass = 'rank-other';
        let rankText = `${rank}`;
        if (rank === 1) { rankBadgeClass = 'rank-1'; rankText = '🥇'; }
        else if (rank === 2) { rankBadgeClass = 'rank-2'; rankText = '🥈'; }
        else if (rank === 3) { rankBadgeClass = 'rank-3'; rankText = '🥉'; }

        const m = String(Math.floor(entry.timeSec / 60)).padStart(2, '0');
        const s = String(entry.timeSec % 60).padStart(2, '0');
        const timeFormatted = `${m}:${s}`;

        const date = new Date(entry.createdAt);
        const dateFormatted = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;

        const hintTag = entry.hintUsed
          ? '<span class="rank-hint-tag rank-hint-used">あり</span>'
          : '<span class="rank-hint-tag rank-hint-none">なし</span>';

        const isHighlight = entry.id === lastSubmittedEntryId ? 'highlight-new' : '';

        // 安全なエスケープ
        const safeName = (entry.name || '名無しパズラー')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

        return `
          <tr class="${isHighlight}">
            <td style="text-align: center;"><span class="rank-num-badge ${rankBadgeClass}">${rankText}</span></td>
            <td><div class="rank-player-name" title="${safeName}">${safeName}</div></td>
            <td style="text-align: right; font-weight: 700; color: #60a5fa;">${entry.moves}手</td>
            <td style="text-align: right;" class="rank-time-val">${timeFormatted}</td>
            <td style="text-align: center;">${hintTag}</td>
            <td style="text-align: right; font-size: 0.75rem; color: var(--text-muted);">${dateFormatted}</td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      console.error('Failed to load ranking:', err);
      rankingLoadingMsg.style.display = 'none';
      rankingEmptyMsg.textContent = '⚠️ ランキングの取得に失敗しました。';
      rankingEmptyMsg.style.display = 'block';
    }
  }

  // ゴール表示（マウス・タッチ長押し）
  previewBtn.addEventListener('mousedown', () => toggleGoalPreview(true));
  window.addEventListener('mouseup', () => {
    if (isPreviewMode) toggleGoalPreview(false);
  });
  previewBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    toggleGoalPreview(true);
  });
  window.addEventListener('touchend', () => {
    if (isPreviewMode) toggleGoalPreview(false);
  });

  // サウンド切替
  soundBtn.addEventListener('click', () => {
    const muted = audio.toggleMute();
    soundBtn.textContent = muted ? '🔇' : '🔊';
  });

  // モーダル開閉
  helpBtn.addEventListener('click', () => helpModal.classList.add('active'));
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.target).classList.remove('active');
    });
  });

  // 盤面外クリックでハイライト解除
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.board-wrapper')) {
      if (selectedNumber !== null) {
        selectedNumber = null;
        applyHighlights();
      }
    }
  });

  // キーボード操作対応 (矢印キーでスライド)
  window.addEventListener('keydown', (e) => {
    if (board.isCompleted || isPreviewMode) return;
    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      if (e.shiftKey) redoBtn.click();
      else undoBtn.click();
      return;
    }
    if (e.key === 'h' || e.key === 'H') {
      toggleConflictHint();
      return;
    }
  });

  /**
   * 軽量紙吹雪パーティクルアニメーション
   */
  function launchConfetti() {
    const ctx = confettiCanvas.getContext('2d');
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.7) * 16,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 8,
        gravity: 0.28,
        opacity: 1
      });
    }

    let frame = 0;
    function anim() {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      let alive = false;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.rotation += p.vRot;
        p.opacity -= 0.007;

        if (p.opacity > 0) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      }

      if (alive && frame < 180) {
        frame++;
        requestAnimationFrame(anim);
      } else {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      }
    }
    requestAnimationFrame(anim);
  }

  /**
   * yukiyanArt 公式アプリ連携データ（Feedback & Release Hub連動）
   */
  /**
   * yukiyanArt 公式アプリ連携マスターデータ（Feedback & Release Hub 連動）
   */
  const ALL_YUKIYANART_APPS = [
    {
      id: 'chronos',
      name: 'Chronos',
      subName: 'カレンダー＆付箋メモ',
      category: '生産性',
      desc: 'カレンダーとデスク付箋が美しく融合。毎日のスケジュールと思考をスマート管理。',
      icon: 'assets/icons/chronos.png',
      color: '#4F46E5',
      url: 'https://yukiyanart-feedback-hub.web.app/?app_id=chronos'
    },
    {
      id: 'desk_chat',
      name: 'Desk Chat',
      subName: 'デスクチャット',
      category: 'コミュニケーション',
      desc: 'デスク上で快適に使えるクイックコミュニケーションツール',
      icon: 'assets/icons/desk_chat.png',
      color: '#059669',
      url: 'https://yukiyanart-feedback-hub.web.app/?app_id=desk_chat'
    },
    {
      id: 'login_manager',
      name: 'LoginManager',
      subName: 'ログイン＆パスワード管理',
      category: 'セキュリティ',
      desc: '安全なログイン情報管理とパスワード保存を行える暗号化セキュリティツール',
      icon: 'assets/icons/pass_manager.png',
      color: '#D97706',
      url: 'https://yukiyanart-feedback-hub.web.app/?app_id=login_manager'
    },
    {
      id: 'aura_gallery',
      name: 'AURAGALLERY',
      subName: 'デジタルアート美術室',
      category: 'アート・展示',
      desc: 'デジタルアート作品をバーチャル展示・鑑賞できるオンライン美術室Webアプリ',
      icon: 'assets/icons/aura_gallery.jpg',
      color: '#EC4899',
      url: 'https://yukiyanart-feedback-hub.web.app/?app_id=aura_gallery'
    },
    {
      id: 'strategy_note',
      name: 'STRATEGYNOTE',
      subName: '戦略思考・マインドマップメモ',
      category: '思考整理',
      desc: '戦略的な思考整理とマインドマップ風ノート作成Webアプリ',
      icon: 'assets/icons/strategy_note.jpg',
      color: '#8B5CF6',
      url: 'https://yukiyanart-feedback-hub.web.app/?app_id=strategy_note'
    },
    {
      id: 'sub_monitor_manager',
      name: 'SubMonitorManager',
      subName: 'マルチモニター仮想画面管理',
      category: 'PCユーティリティ',
      desc: 'サブモニターの配置・レイアウト・ショートカット切替を効率化するマルチモニター管理ツール',
      icon: 'assets/icons/sub_monitor_manager.png',
      color: '#0284C7',
      url: 'https://yukiyanart-feedback-hub.web.app/?app_id=sub_monitor_manager'
    },
    {
      id: 'input_nexus',
      name: 'InputNexus',
      subName: 'デバイス・キーバインド統合管理',
      category: 'ユーティリティ・ゲーム',
      desc: 'キーボード・マウス・コントローラー（ゲームパッド）のリアルタイム入力可視化＆割り当てツール',
      icon: 'assets/icons/input_nexus.jpg',
      color: '#6366F1',
      url: 'https://yukiyanart-feedback-hub.web.app/?app_id=input_nexus'
    },
    {
      id: 'widget_de_news',
      name: 'widgetでnews',
      subName: '常駐ニュース＆雨雲・PCモニター',
      category: 'ニュース・防災',
      desc: '画面端に常駐し、各種ニュース・雨雲レーダー・アメダス・PCモニターを可視化するスマートウィジェット',
      icon: 'assets/icons/widget_de_news.png',
      color: '#10B981',
      url: 'https://yukiyanart-feedback-hub.web.app/?app_id=widget_de_news'
    },
    {
      id: 'numpre_shift',
      name: '動くナンプレ',
      subName: 'スライド×数独 脳トレパズル',
      category: 'ゲーム・パズル',
      desc: '3x3の数字ブロックを動かして解き明かす、新感覚のオンライン対戦＆脳トレ数独Webゲーム',
      icon: 'assets/icons/numpre_shift.png',
      color: '#F59E0B',
      url: 'https://yukiyanart-feedback-hub.web.app/?app_id=numpre_shift'
    },
    {
      id: 'hex_bastion',
      name: 'HEX BASTION',
      subName: '六角形グリッド防衛戦略',
      category: 'ゲーム・戦略',
      desc: 'ヘックス（六角形）盤面で拠点を防衛・攻略する本格タクティカル戦略ゲーム',
      icon: 'assets/icons/hex_bastion.jpg',
      color: '#EF4444',
      url: 'https://yukiyanart-feedback-hub.web.app/?app_id=hex_bastion'
    },
    {
      id: 'flower_coloring',
      name: '花と絵',
      subName: 'Flower Growing Coloring App',
      category: 'アート・育成・リラックス',
      desc: '温室で四季の花を育て、花弁から天然インクを調合して水彩・混色塗り絵を楽しむ癒やしのアトリエWebアプリ',
      icon: 'assets/icons/flower_coloring.png',
      color: '#10B981',
      url: 'https://yukiyanart-feedback-hub.web.app/?app_id=flower_coloring'
    },
    {
      id: 'tokyo_gassen',
      name: '東京合戦',
      subName: '東京都全53市区町村 開拓×合戦シミュレーション',
      category: 'シミュレーション・領土戦略',
      desc: '東京都全53市区町村どこからでも旗揚げ可能！開拓内政、特産品外交、レトロFF風3v3コマンド合戦で東京統一を目指す本格戦略Webゲーム',
      icon: 'assets/icons/tokyo_gassen.png',
      color: '#DC2626',
      url: 'https://yukiyanart-feedback-hub.web.app/?app_id=tokyo_gassen'
    }
  ];

  // 動くナンプレ内では自アプリを除外してローテーション
  const YUKIYANART_APPS = ALL_YUKIYANART_APPS.filter(a => a.id !== 'numpre_shift');

  let currentPromoAppIndex = 0;
  let promoRotatorInterval = null;

  function updatePromoBanner(index) {
    currentPromoAppIndex = (index + YUKIYANART_APPS.length) % YUKIYANART_APPS.length;
    const app = YUKIYANART_APPS[currentPromoAppIndex];

    const promoBanner = document.getElementById('promo-banner');
    const promoIcon = document.getElementById('promo-app-icon');
    const promoName = document.getElementById('promo-app-name');
    const promoSub = document.getElementById('promo-app-sub');
    const promoCat = document.getElementById('promo-app-cat');
    const promoDesc = document.getElementById('promo-app-desc');
    const promoLink = document.getElementById('promo-cta-link');

    if (promoBanner && app.color) {
      promoBanner.style.setProperty('--app-accent', app.color);
    }
    if (promoIcon) {
      promoIcon.style.opacity = '0.4';
      promoIcon.src = app.icon;
      promoIcon.alt = app.name;
      promoIcon.onload = () => { promoIcon.style.opacity = '1'; };
      promoIcon.onerror = () => {
        promoIcon.src = `https://yukiyanart-feedback-hub.web.app/${app.icon}`;
        promoIcon.style.opacity = '1';
      };
    }
    if (promoName) promoName.textContent = app.name;
    if (promoSub) promoSub.textContent = app.subName;
    if (promoCat) promoCat.textContent = app.category;
    if (promoDesc) promoDesc.textContent = app.desc;
    if (promoLink) {
      promoLink.href = app.url;
      promoLink.title = `${app.name} の入手・要望窓口（Feedback & Release Hub）を開く`;
      promoLink.textContent = `Hubで見る ↗`;
    }
  }

  function startPromoRotator() {
    if (promoRotatorInterval) clearInterval(promoRotatorInterval);
    promoRotatorInterval = setInterval(() => {
      updatePromoBanner(currentPromoAppIndex + 1);
    }, 6000);
  }

  const promoBannerElem = document.getElementById('promo-banner');
  if (promoBannerElem) {
    // ホバー中は自動ローテーションを一時停止して読みやすくする
    promoBannerElem.addEventListener('mouseenter', () => {
      if (promoRotatorInterval) clearInterval(promoRotatorInterval);
    });
    promoBannerElem.addEventListener('mouseleave', () => {
      startPromoRotator();
    });
  }

  const promoPrevBtn = document.getElementById('promo-prev-btn');
  const promoNextBtn = document.getElementById('promo-next-btn');
  if (promoPrevBtn) {
    promoPrevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startPromoRotator();
      updatePromoBanner(currentPromoAppIndex - 1);
    });
  }
  if (promoNextBtn) {
    promoNextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startPromoRotator();
      updatePromoBanner(currentPromoAppIndex + 1);
    });
  }

  updatePromoBanner(0);
  startPromoRotator();

  // 初回ゲーム開始
  startNewGame('normal');
}

// DOM読み込み完了時に確実に初期化（既に読み込み済みの場合も即座に実行）
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
