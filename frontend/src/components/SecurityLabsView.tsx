import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Terminal,
  Flag,
  Plus,
  Check,
  Lock,
  Copy,
  CheckCircle2,
  Trash2,
  Flame,
} from 'lucide-react';
import type { Habit } from '../types/habit';

interface SecurityLabsViewProps {
  habits: Habit[];
  onQuickCreateLab: (title: string) => Promise<void>;
  onSubmitLabProof: (habitId: string, proofNote: string) => Promise<void>;
  onUncheckLab: (habitId: string) => Promise<void>;
  onDeleteLab: (habitId: string) => Promise<void>;
}

const SECURITY_LAB_TEMPLATES = [
  {
    title: 'Complete 1 TryHackMe Room',
    tool: 'TryHackMe / OpenVPN',
    difficulty: 'Intermediate',
    desc: 'Connect via OpenVPN, enumerate the target host, and document your findings.',
  },
  {
    title: 'Nmap Recon & Port Enumeration Lab',
    tool: 'Nmap',
    difficulty: 'Foundational',
    desc: 'Run service and version detection (-sC -sV) and summarize open ports.',
  },
  {
    title: 'Metasploit Vulnerability Assessment',
    tool: 'Metasploit',
    difficulty: 'Advanced',
    desc: 'Verify service CVE exposure in a controlled lab environment and document remediation.',
  },
  {
    title: 'Authentication Resilience Audit',
    tool: 'Hydra',
    difficulty: 'Intermediate',
    desc: 'Evaluate login rate-limiting and password policy strength in a practice lab.',
  },
];

const RECON_SNIPPETS = [
  { label: 'Service & Version Scan', cmd: 'nmap -sC -sV -T4 -p- <TARGET_IP>' },
  { label: 'Auth Resilience Check (Hydra)', cmd: 'hydra -l admin -P rockyou.txt ssh://<TARGET_IP>' },
  { label: 'OpenVPN Lab Tunnel', cmd: 'sudo openvpn --config lab_session.ovpn' },
];

export function SecurityLabsView({
  habits,
  onQuickCreateLab,
  onSubmitLabProof,
  onUncheckLab,
  onDeleteLab,
}: SecurityLabsViewProps) {
  const [activeProofId, setActiveProofId] = useState<string | null>(null);
  const [flagOrProof, setFlagOrProof] = useState<string>('');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [creatingTitle, setCreatingTitle] = useState<string | null>(null);

  const securityHabits = habits.filter((h) => h.category === 'Cybersecurity' && !h.isArchived);
  const completedLabsToday = securityHabits.filter((h) => h.completedToday).length;

  function copyCommand(cmd: string) {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 1800);
  }

  async function handleDeployTemplate(title: string) {
    setCreatingTitle(title);
    try {
      await onQuickCreateLab(title);
    } finally {
      setCreatingTitle(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                Cybersecurity Practice Labs
              </h2>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Writeup & Flag Log
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Track hands-on security labs, network reconnaissance practice, and study writeups.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-slate-50 px-5 py-3 rounded-xl border border-slate-200/80 tabular-nums">
          <div>
            <div className="text-2xl font-extrabold text-emerald-600">
              {completedLabsToday}/{securityHabits.length}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">Completed Today</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 space-y-5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-base font-bold text-slate-900">
              Active Security Habits ({securityHabits.length})
            </h3>
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <Flag className="w-3.5 h-3.5 text-emerald-600" /> Summary note required on check-in
            </span>
          </div>

          {securityHabits.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center">
              <Shield className="w-8 h-8 text-emerald-600 mx-auto mb-2 opacity-85" />
              <p className="text-sm font-bold text-slate-900">No security lab habits yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Choose one of the starter templates below to add regular security lab practice to
                your schedule.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {securityHabits.map((lab) => {
                const isProofOpen = activeProofId === lab.id;
                return (
                  <div
                    key={lab.id}
                    className={`rounded-2xl p-5 flex flex-col justify-between border transition shadow-xs ${
                      lab.completedToday
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : 'bg-white border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 tabular-nums">
                          <Shield className="w-3 h-3" /> Security {"\u2022"}{' '}
                          <Flame className="w-3 h-3 text-amber-500" /> {lab.currentStreak}d
                        </span>
                        <button
                          type="button"
                          onClick={() => onDeleteLab(lab.id)}
                          aria-label={`Delete ${lab.title}`}
                          className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title="Delete habit"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <h4 className="text-base font-bold text-slate-900 mb-1">{lab.title}</h4>
                      <p className="text-xs text-slate-500">
                        {lab.todayNote ? (
                          <span className="text-emerald-700 font-medium">
                            Note: "{lab.todayNote}"
                          </span>
                        ) : (
                          'Add a room name, lab topic, or takeaway note to complete today.'
                        )}
                      </p>

                      {isProofOpen && (
                        <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <input
                            type="text"
                            aria-label="Lab completion note"
                            value={flagOrProof}
                            onChange={(e) => setFlagOrProof(e.target.value)}
                            placeholder="e.g., Completed Nmap enumeration room"
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 mb-2"
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveProofId(null)}
                              className="text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await onSubmitLabProof(lab.id, flagOrProof);
                                setActiveProofId(null);
                                setFlagOrProof('');
                              }}
                              className="text-xs font-semibold px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                            >
                              Save Note
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 mt-5 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-1">
                        {lab.weeklyProgress.map((d, i) => {
                          const isToday = i === lab.weeklyProgress.length - 1;
                          return (
                            <span
                              key={d.date}
                              className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                                d.completed
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                  : isToday
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              {d.completed ? (
                                <Check className="w-3 h-3 stroke-[2.5]" />
                              ) : isToday ? (
                                'o'
                              ) : (
                                '-'
                              )}
                            </span>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (lab.completedToday) {
                            onUncheckLab(lab.id);
                          } else {
                            setActiveProofId(lab.id);
                            setFlagOrProof('');
                          }
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition ${
                          lab.completedToday
                            ? 'bg-emerald-600 text-white'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                      >
                        {lab.completedToday ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Completed</span>
                          </>
                        ) : (
                          <>
                            <Flag className="w-3.5 h-3.5" />
                            <span>Log Lab</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-2">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              Starter Security Lab Templates
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SECURITY_LAB_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.title}
                  className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-4 flex flex-col justify-between gap-3 transition shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-emerald-700">{tpl.tool}</span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                        {tpl.difficulty}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">{tpl.title}</h4>
                    <p className="text-xs text-slate-500 mt-1">{tpl.desc}</p>
                  </div>
                  <button
                    type="button"
                    disabled={creatingTitle === tpl.title}
                    onClick={() => handleDeployTemplate(tpl.title)}
                    className="w-full py-2 rounded-xl bg-slate-100 hover:bg-indigo-600 hover:text-white text-xs font-semibold text-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      {creatingTitle === tpl.title ? 'Adding...' : 'Add to Habits'}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="xl:col-span-4 space-y-5">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2.5 mb-2">
              <Terminal className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">Quick Reference Commands</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Click any snippet to copy it to your clipboard for lab sessions:
            </p>

            <div className="space-y-3">
              {RECON_SNIPPETS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => copyCommand(item.cmd)}
                  className="w-full text-left p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-indigo-300 cursor-pointer transition group"
                >
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                    <span className="font-medium">{item.label}</span>
                    {copiedCmd === item.cmd ? (
                      <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Copied
                      </span>
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700" />
                    )}
                  </div>
                  <code className="text-xs text-indigo-700 font-mono break-all">{item.cmd}</code>
                </button>
              ))}
            </div>

            <div className="mt-6 p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Verification Note:</strong> Record the lab name or a short takeaway note
                when checking in so your learning log stays meaningful.
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}