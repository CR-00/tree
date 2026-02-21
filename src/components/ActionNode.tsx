'use client';

import { Handle, Position } from '@xyflow/react';

interface ActionNodeProps {
  data: {
    nodeId: string;
    label: string;
    action: string;
    player: 'OOP' | 'IP';
    street: string;
    frequency: number;
    gtoFrequency: number;
    weakPercent?: number;
    gtoWeakPercent?: number;
    reachProbability: number;
    isOverfold?: boolean;
    isUnderfold?: boolean;
    isOverbluff?: boolean;
    isUnderbluff?: boolean;
    isMissedExploit?: boolean;
    isExploiting?: boolean;
    isFloatOpportunity?: boolean;
    floatEV?: number;
    bluffEV?: number;
    potSize: number;
    sizing?: number;
    actionAmount?: number;
    oopCombos: number;
    ipCombos: number;
    showCombos?: boolean;
    line?: string;
  };
}

// Determine frequency comparison class
function getFreqCompareClass(actual: number, gto: number): string {
  const diff = actual - gto;
  if (Math.abs(diff) < 3) return 'equal'; // Within 3% is considered equal
  return diff > 0 ? 'higher' : 'lower';
}

export function ActionNode({ data }: ActionNodeProps) {
  const {
    label,
    action,
    player,
    street,
    frequency,
    gtoFrequency,
    weakPercent,
    gtoWeakPercent,
    reachProbability,
    isOverfold,
    isUnderfold,
    isOverbluff,
    isUnderbluff,
    isMissedExploit,
    isExploiting,
    isFloatOpportunity,
    floatEV,
    bluffEV,
    potSize,
    sizing,
    actionAmount,
    oopCombos,
    ipCombos,
    showCombos,
    line,
  } = data;

  const playerClass = player.toLowerCase();
  let leakClass = '';
  if (isMissedExploit) leakClass = 'missed-exploit';
  else if (isExploiting) leakClass = 'exploiting';
  else if (isOverfold) leakClass = 'overfold';
  else if (isUnderfold) leakClass = 'underfold';
  else if (isOverbluff) leakClass = 'overbluff';
  else if (isUnderbluff) leakClass = 'underbluff';

  const freq = Math.round(frequency * 100);
  const gto = Math.round(gtoFrequency * 100);
  const reach = (reachProbability * 100).toFixed(1);
  const hasWeak = weakPercent !== undefined && gtoWeakPercent !== undefined;
  const hasSizing = (action === 'bet' || action === 'raise') && sizing !== undefined;
  const showActionAmount = actionAmount !== undefined && actionAmount > 0;

  // Equity calculations
  const isBetRaise = action === 'bet' || action === 'raise';
  const requiredFoldEquity =
    isBetRaise && actionAmount !== undefined && potSize > 0
      ? Math.round((actionAmount / potSize) * 100)
      : null;

  // Format action label with sizing if applicable
  const displayLabel = hasSizing
    ? action === 'raise' ? `${label}${sizing}X` : `${label}${sizing}`
    : label;

  const actionAmountLabel =
    action === 'raise' ? 'Raise' : action === 'bet' ? 'Bet' : 'Call';

  // Get comparison classes for color coding
  const freqCompare = getFreqCompareClass(freq, gto);
  const weakFreq = hasWeak ? Math.round(weakPercent! * 100) : 0;
  const weakGto = hasWeak ? Math.round(gtoWeakPercent! * 100) : 0;
  const weakCompare = hasWeak ? getFreqCompareClass(weakFreq, weakGto) : 'equal';

  return (
    <div className={`action-card ${leakClass}`}>
      <Handle type="target" position={Position.Top} className="handle" />

      <div className="action-card-header">
        <div className="action-label-group">
          <span className="action-label" title={line || displayLabel}>
            {line || displayLabel}
          </span>
          {isMissedExploit && (
            <span className="exploit-badge missed" title="Missed exploit opportunity - opponent is overbluffing but you're folding too much">
              MISS
            </span>
          )}
          {isExploiting && (
            <span className="exploit-badge good" title="Exploiting opponent - correctly calling more vs their overbluffs">
              EXPLOIT
            </span>
          )}
        </div>
        <div className="header-badges">
          <span className={`street-badge ${street.toLowerCase()}`} title={`Street: ${street === 'F' ? 'Flop' : street === 'T' ? 'Turn' : 'River'}`}>
            {street}
          </span>
          <span className={`player-badge ${playerClass}`} title={`Player: ${player === 'OOP' ? 'Out of Position' : 'In Position'}`}>
            {player}
          </span>
        </div>
      </div>

      <div className="card-meta-row">
        <div className="meta-item" title="Current pot size in big blinds">
          <span className="meta-label">Pot</span>
          <span className="meta-value">{potSize.toFixed(1)} BB</span>
        </div>
        {showActionAmount && (
          <div className="meta-item" title={`${actionAmountLabel} size: ${actionAmount!.toFixed(2)} BB`}>
            <span className="meta-label">{actionAmountLabel}</span>
            <span className="meta-value">{actionAmount!.toFixed(1)} BB</span>
          </div>
        )}
        <div className="meta-item" title="Reach probability - how often we arrive at this decision point (does not include this node's own action frequency)">
          <span className="meta-label">Reach</span>
          <span className="meta-value">{reach}%</span>
        </div>
        {showCombos && (
          <div className="meta-item" title={`${player} combos at this decision point`}>
            <span className="meta-label">Combos</span>
            <span className="meta-value">{(player === 'OOP' ? oopCombos : ipCombos).toFixed(1)}</span>
          </div>
        )}
        {isFloatOpportunity && floatEV !== undefined && (
          <div className="meta-item" title={`Float EV: the bluffing opportunity on the next street is worth +${floatEV.toFixed(2)} BB, exceeding the call cost`}>
            <span className="meta-label">Float EV</span>
            <span className="meta-value float-ev-value">+{floatEV.toFixed(1)}</span>
          </div>
        )}
        {requiredFoldEquity !== null && (
          <div className="meta-item" title={`Required Fold Equity: Opponent must fold at least ${requiredFoldEquity}% of the time for a bluff to be profitable (bet / (pot + bet))`}>
            <span className="meta-label">Req. FE</span>
            <span className="meta-value">{requiredFoldEquity}%</span>
          </div>
        )}
        {bluffEV !== undefined && (
          <div className="meta-item" title={`Bluff EV: expected value of a pure bluff at this node given opponent's actual fold frequency (${bluffEV >= 0 ? '+' : ''}${bluffEV.toFixed(2)} BB)`}>
            <span className="meta-label">Bluff EV</span>
            <span className="meta-value" style={{ color: bluffEV >= 0 ? '#69db7c' : '#ff6b6b' }}>
              {bluffEV >= 0 ? '+' : ''}{bluffEV.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      <div className="action-card-stats">
        <div
          className={`freq-bar-container ${freqCompare}`}
          title={`Frequency: How often this action is taken.\nActual: ${freq}% | GTO: ${gto}%\n${freqCompare === 'higher' ? 'Taking this action MORE than GTO' : freqCompare === 'lower' ? 'Taking this action LESS than GTO' : 'Close to GTO frequency'}`}
        >
          <div className="freq-bar">
            <div className="freq-bar-gto" style={{ width: `${gto}%` }} />
            <div className="freq-bar-actual" style={{ width: `${freq}%` }} />
          </div>
          <div className="freq-labels">
            <span className="freq-actual">{freq}%</span>
            <span className="freq-gto">{gto}%</span>
          </div>
        </div>
        {hasWeak && (
          <div
            className={`freq-bar-container weak ${weakCompare}`}
            title={`Bluff/Weak %: Portion of betting range that is bluffs.\nActual: ${weakFreq}% | GTO: ${weakGto}%\n${weakCompare === 'higher' ? 'Bluffing MORE than GTO (overbluffing)' : weakCompare === 'lower' ? 'Bluffing LESS than GTO (underbluffing)' : 'Close to GTO bluff frequency'}`}
          >
            <div className="freq-bar">
              <div className="freq-bar-gto" style={{ width: `${weakGto}%` }} />
              <div className="freq-bar-actual" style={{ width: `${weakFreq}%` }} />
            </div>
            <div className="freq-labels">
              <span className="freq-actual">{weakFreq}%</span>
              <span className="freq-gto">{weakGto}%</span>
            </div>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="handle" />
    </div>
  );
}
