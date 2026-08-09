// ===== BLOCK BOTH ENDS ANALYZER =====
// Finds the opponent's open chain ends that should be occupied by the AI.
// PatternDetector remains the pattern/rule engine; this module only chooses
// defensive cells from those facts.
const BlockBothEndsAnalyzer = {
	resolveRules(winCount) {
		const activeRules = (typeof GameState !== 'undefined' && GameState.roomRules)
			? GameState.roomRules
			: (typeof window !== 'undefined' ? window.roomRules : undefined);
		return {
			winCount: activeRules && typeof activeRules.winCount === 'number'
				? activeRules.winCount
				: (typeof winCount === 'number' ? winCount : 5),
			chan2Dau: activeRules && typeof activeRules.chan2Dau === 'boolean'
				? activeRules.chan2Dau
				: (typeof getBlockBothEnds === 'function' ? getBlockBothEnds() : true)
		};
	},

	getCandidates() {
		if (typeof getAllTacticalCells === 'function') {
			return getAllTacticalCells().filter(({ r, c }) => getCell(r, c) === '');
		}
		return [];
	},

	isCandidateOpen(r, c, dr, dc, player) {
		if (typeof PatternDetector !== 'undefined' && typeof PatternDetector.isBlocked === 'function') {
			return !PatternDetector.isBlocked(r, c, dr, dc, player);
		}

		const opponent = player === 'X' ? 'O' : 'X';
		const maxEmpty = 5;
		let emptyCount = 0;
		let nr = r;
		let nc = c;
		while (emptyCount <= maxEmpty) {
			const cell = getCell(nr, nc);
			if (cell === opponent || cell === 'W') return false;
			if (cell === player) return true;
			if (cell === '') {
				emptyCount++;
				nr += dr;
				nc += dc;
				continue;
			}
			return true;
		}
		return true;
	},

	findWinningMoves(player, candidates, rules, reason = 'immediate_win_block') {
		const winningMoves = [];
		const defender = player === 'X' ? 'O' : 'X';
		for (const { r, c } of candidates) {
			setCell(r, c, player);
			const wins = typeof checkWinSilent === 'function'
				? checkWinSilent(r, c, rules)
				: false;
			setCell(r, c, '');
			if (wins) {
				// A broken FOUR (for example XXX_X) is an internal gap,
				// not an end extension. It must be blocked even when one
				// end of the completed line is already closed.
				const isBrokenGap = reason === 'immediate_win_block' &&
					this.isInternalGapCandidate(r, c, player);
				if (reason === 'immediate_win_block' &&
					!isBrokenGap && !this.hasOpenThreatEndAtCandidate(r, c, player, rules)) {
					continue;
				}
				const score = this.scoreBlockMove(r, c, defender, rules);
				const metadata = reason === 'immediate_win_block'
					? this.getThreatMetadataAtCandidate(r, c, player, rules)
					: { openEnds: 1, wouldDeadChain: false };
				winningMoves.push({
					r, c,
					chainCount: rules.winCount - 1,
					openEnds: metadata.openEnds,
					wouldDeadChain: metadata.wouldDeadChain,
					priority: 10000,
					score,
					reason
				});
			}
		}
		winningMoves.sort((a, b) => b.score - a.score || b.priority - a.priority);
		return winningMoves;
	},

	getThreatMetadataAtCandidate(r, c, player, rules) {
		if (typeof DIRECTIONS === 'undefined') return { openEnds: 0, wouldDeadChain: false };
		for (const { dr, dc } of DIRECTIONS) {
			for (const sign of [1, -1]) {
				const scanDr = dr * sign;
				const scanDc = dc * sign;
				let nr = r + scanDr;
				let nc = c + scanDc;
				let gap = 0;
				while (getCell(nr, nc) === '' && gap < rules.winCount) {
					nr += scanDr;
					nc += scanDc;
					gap++;
				}
				if (getCell(nr, nc) !== player) continue;
				let count = 0;
				while (getCell(nr, nc) === player) {
					count++;
					nr += scanDr;
					nc += scanDc;
				}
				if (count < rules.winCount - 1) continue;
				if (!this.isCandidateOpen(r, c, -scanDr, -scanDc, player)) continue;
				const oppositeOpen = this.isCandidateOpen(nr, nc, scanDr, scanDc, player);
				return { openEnds: oppositeOpen ? 2 : 1, wouldDeadChain: !oppositeOpen };
			}
		}
		return { openEnds: 0, wouldDeadChain: false };
	},

	isInternalGapCandidate(r, c, player) {
		if (typeof DIRECTIONS === 'undefined') return false;
		return DIRECTIONS.some(({ dr, dc }) =>
			getCell(r + dr, c + dc) === player &&
			getCell(r - dr, c - dc) === player
		);
	},

	hasOpenThreatEndAtCandidate(r, c, player, rules) {
		return this.getThreatMetadataAtCandidate(r, c, player, rules).openEnds > 0;
	},

	getPriorityTacticalMove(player, opponent, winCount) {
		const rules = this.resolveRules(winCount);
		const candidates = this.getCandidates();
		if (candidates.length === 0) return null;

		// Phase 1: the bot must take a legal winning move first.
		const winningMove = this.findWinningMoves(player, candidates, rules, 'immediate_win')[0];
		if (winningMove) return winningMove;

		// All opponent threats are the same defensive problem: find the
		// viable/open end first, then rank immediate win, FOUR and THREE.
		const defenseMoves = this.findDefenseMoves(opponent, player, candidates, rules);
		const selected = defenseMoves[0] || null;
		if (selected) {
			console.log('[BlockBothEndsAnalyzer] priority defense:', {
				player,
				opponent,
				rules,
				selected,
				topCandidates: defenseMoves.slice(0, 8)
			});
		}
		return selected;
	},

	getDisplayScore(r, c, player, opponent, winCount, fallbackScore = 0) {
		const rules = this.resolveRules(winCount);
		const candidates = this.getCandidates();
		const defenseMoves = this.findDefenseMoves(opponent, player, candidates, rules);
		if (defenseMoves.length === 0) return fallbackScore;

		const defenseMove = defenseMoves.find(move => move.r === r && move.c === c);
		if (!defenseMove) return 0;

		return defenseMove.priority * 100 + Math.max(0, defenseMove.score || 0);
	},

	// Backward-compatible alias for callers not yet migrated.
	getImmediateTacticalMove(player, opponent, winCount) {
		return this.getPriorityTacticalMove(player, opponent, winCount);
	},

	findDefenseMoves(opponent, defender, candidates, rules) {
		const immediate = this.findWinningMoves(opponent, candidates, rules, 'immediate_win_block');
		const four = this.findOpenChainEnds(opponent, candidates, rules, rules.winCount - 1);
		const three = this.findOpenChainEnds(opponent, candidates, rules, rules.winCount - 2)
			.filter(move => move.chainCount < rules.winCount - 1);
		const moves = [...immediate, ...four, ...three];
		const seen = new Set();

		for (const move of moves) {
			const key = `${move.r},${move.c}`;
			if (seen.has(key)) {
				move.priority = -Infinity;
				continue;
			}
			seen.add(key);
			if (move.score === undefined) {
				move.score = this.scoreBlockMove(move.r, move.c, defender, rules);
			}
		}

		return moves
			.filter(move => Number.isFinite(move.priority))
			.sort((a, b) => b.priority - a.priority || b.score - a.score || b.chainCount - a.chainCount);
	},

	scoreBlockMove(r, c, defender, rules) {
		const threatPlayer = defender === 'X' ? 'O' : 'X';
		let openEndBonus = 0;
		for (const { dr, dc } of (typeof DIRECTIONS !== 'undefined' ? DIRECTIONS : [])) {
			for (const sign of [1, -1]) {
				const scanDr = dr * sign;
				const scanDc = dc * sign;
				let nr = r + scanDr;
				let nc = c + scanDc;
				let chainCount = 0;
				while (getCell(nr, nc) === threatPlayer) {
					chainCount++;
					nr += scanDr;
					nc += scanDc;
				}
				if (chainCount >= rules.winCount - 1) {
					// The candidate is on the opposite side of the chain from
					// this scan. Prefer the candidate whose outside side is open.
					const candidateOpen = this.isCandidateOpen(r, c, -scanDr, -scanDc, threatPlayer);
					if (candidateOpen) openEndBonus += 500000;
					else openEndBonus -= 100000;
				}
			}
		}

		setCell(r, c, defender);
		let score = openEndBonus;

		// A block that also wins for the bot is the best legal response.
		if (typeof checkWinSilent === 'function' && checkWinSilent(r, c, rules)) {
			score += 1000000000;
		}

		// Prefer a block that builds useful local threats for the bot.
		if (typeof quickScore === 'function') {
			score += quickScore(r, c, defender);
		} else if (typeof PatternDetector !== 'undefined' && typeof PatternDetector.evalCell === 'function') {
			const patterns = PatternDetector.evalCell(r, c, defender, rules.winCount, rules.chan2Dau);
			for (const { pattern } of patterns) {
				if (pattern === PatternDetector.PATTERN.FOUR_OPEN) score += 100000;
				else if (pattern === PatternDetector.PATTERN.THREE_OPEN) score += 10000;
				else if (pattern === PatternDetector.PATTERN.TWO_OPEN) score += 1000;
			}
		}

		// Break ties in favor of a block connected to nearby bot stones.
		for (const { dr, dc } of (typeof DIRECTIONS !== 'undefined' ? DIRECTIONS : [])) {
			if (getCell(r + dr, c + dc) === defender) score += 100;
			if (getCell(r - dr, c - dc) === defender) score += 100;
		}
		setCell(r, c, '');
		return score;
	},

	findOpenChainEnds(player, candidates, rules, minimumChain) {
		if (!rules.chan2Dau || typeof DIRECTIONS === 'undefined') return [];

		const results = [];
		const seen = new Set();
		for (const { r, c } of candidates) {
			for (const { dr, dc } of DIRECTIONS) {
				for (const sign of [1, -1]) {
					const scanDr = dr * sign;
					const scanDc = dc * sign;
					let nr = r + scanDr;
					let nc = c + scanDc;
					let chainCount = 0;
					let gap = 0;

					// A blocking candidate may be separated from the chain by
					// empty cells. Walk across that gap before counting the chain.
					while (getCell(nr, nc) === '' && gap < rules.winCount) {
						nr += scanDr;
						nc += scanDc;
						gap++;
					}

					while (getCell(nr, nc) === player) {
						chainCount++;
						nr += scanDr;
						nc += scanDc;
					}

					if (chainCount < minimumChain) continue;

					// The candidate-side end must be open. A distant defender or
					// wall through empty cells closes it just like an adjacent one.
					if (!this.isCandidateOpen(r, c, -scanDr, -scanDc, player)) continue;
					const oppositeEndOpen = this.isCandidateOpen(nr, nc, scanDr, scanDc, player);

					const key = `${r},${c}`;
					if (seen.has(key)) continue;
					seen.add(key);
					results.push({
						r,
						c,
						chainCount,
						openEnds: oppositeEndOpen ? 2 : 1,
						wouldDeadChain: !oppositeEndOpen,
						priority: chainCount >= rules.winCount - 1 ? 9000 : 7000,
						reason: 'open_end_block'
					});
				}
			}
		}
		return results;
	},

	getBestBlockMoves(opponent, defender, winCount, minimumChain = winCount - 2) {
		const rules = this.resolveRules(winCount);
		const candidates = this.getCandidates();
		if (candidates.length === 0) return [];

		return this.findDefenseMoves(opponent, defender, candidates, rules)
			.filter(move => move.chainCount >= minimumChain);
	},

	findBlockPositions(opponent, winCount, includeOpenEnds = true) {
		const rules = this.resolveRules(winCount);
		const candidates = this.getCandidates();
		if (candidates.length === 0) return [];

		const moves = this.findDefenseMoves(opponent, opponent === 'X' ? 'O' : 'X', candidates, rules);
		return includeOpenEnds ? moves : moves.filter(move => move.reason === 'immediate_win_block');
	}
};
