"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { PlannedExpense } from "@/lib/planned-expenses";
import type { TrackerSettings } from "@/lib/settings";
import type { ParsedTransaction } from "@/lib/transactions";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dayFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

type LoadState = "loading" | "ready" | "error";

type TransactionGroup = {
  dayKey: string;
  dayLabel: string;
  total: number;
  transactions: ParsedTransaction[];
};

type Forecast = {
  periodSpent: number;
  dailyAverage: number;
  projectedThirtyDays: number;
  plannedUpcoming: number;
  projectedWithPlanned: number;
  availableBudget: number;
  delta: number;
  elapsedDays: number;
};

export default function TransactionsDashboard() {
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [plannedExpenses, setPlannedExpenses] = useState<PlannedExpense[]>([]);
  const [settings, setSettings] = useState<TrackerSettings | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [dateFrom, setDateFrom] = useState(getSalaryPeriodStartDateKey);
  const [dateTo, setDateTo] = useState(getTodayDateKey);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isPlannedModalOpen, setIsPlannedModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<ParsedTransaction | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    try {
      const response = await fetch("/api/transactions", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Request failed");
      }

      const nextTransactions = (await response.json()) as ParsedTransaction[];

      setTransactions(nextTransactions);
      setLastUpdatedAt(new Date());
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, []);

  const loadSettings = useCallback(async () => {
    const response = await fetch("/api/settings", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Settings request failed");
    }

    const nextSettings = (await response.json()) as TrackerSettings;

    setSettings(nextSettings);
    setDateFrom(nextSettings.salaryAnchorDate);
    setDateTo(getTodayDateKey());
  }, []);

  const loadPlannedExpenses = useCallback(async () => {
    const response = await fetch("/api/planned-expenses", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Planned expenses request failed");
    }

    const nextPlannedExpenses = (await response.json()) as PlannedExpense[];

    setPlannedExpenses(nextPlannedExpenses);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadTransactions();
      loadSettings().catch(() => setLoadState("error"));
      loadPlannedExpenses().catch(() => setLoadState("error"));
    }, 0);
    const intervalId = window.setInterval(loadTransactions, 3600000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [loadPlannedExpenses, loadSettings, loadTransactions]);

  const filteredTransactions = useMemo(
    () => filterTransactionsByDateRange(transactions, dateFrom, dateTo),
    [transactions, dateFrom, dateTo]
  );
  const hasActiveDateFilter = dateFrom !== "" || dateTo !== "";

  const totalAmount = useMemo(
    () =>
      filteredTransactions.reduce(
        (total, transaction) => total + (transaction.amount ?? 0),
        0
      ),
    [filteredTransactions]
  );

  const parsedCount = filteredTransactions.filter(
    (transaction) => transaction.status === "parsed"
  ).length;

  const transactionGroups = useMemo(
    () => groupTransactionsByDay(filteredTransactions),
    [filteredTransactions]
  );

  const forecast = useMemo(
    () =>
      settings
        ? calculateForecast(transactions, settings, plannedExpenses)
        : null,
    [plannedExpenses, settings, transactions]
  );

  async function handleDeleteTransaction(transaction: ParsedTransaction) {
    const confirmed = window.confirm(
      `Eliminare il pagamento "${transaction.recipient}"?`
    );

    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/transactions/${transaction.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setOpenActionId(null);
      await loadTransactions();
    }
  }

  async function handleSettingsSaved(nextSettings: TrackerSettings) {
    setSettings(nextSettings);
    setDateFrom(nextSettings.salaryAnchorDate);
    setDateTo(getTodayDateKey());
    await loadTransactions();
  }

  return (
    <main className="min-h-screen bg-[#f3f6fb] text-[#17202f]">
      <section className="border-b border-[#dbe3ee] bg-[#fbfcff]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(true)}
                className="rounded-md border border-[#cad4e1] bg-white px-3 py-2 text-sm font-semibold text-[#17202f] shadow-sm transition hover:border-[#0f8f8c] hover:bg-[#eefafa]"
              >
                Imposta stipendio
              </button>
              <p className="mt-5 text-sm font-semibold uppercase text-[#0f8f8c]">
                Tracking spese
              </p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
                Ma quanto spendi?
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[#657386]">
                Ecco una lista delle tue spese recenti, aggiornata in tempo reale ogni volta che arriva.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsAddMenuOpen((isOpen) => !isOpen)}
                  className="h-11 rounded-md bg-[#0f8f8c] px-4 text-xl font-semibold leading-none text-white shadow-sm transition hover:bg-[#0b7471] focus:outline-none focus:ring-2 focus:ring-[#0f8f8c] focus:ring-offset-2"
                  aria-label="Aggiungi pagamento"
                >
                  +
                </button>
                {isAddMenuOpen ? (
                  <div className="absolute right-0 z-20 mt-2 grid min-w-56 overflow-hidden rounded-md border border-[#dbe3ee] bg-white text-sm font-semibold shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualModalOpen(true);
                        setIsAddMenuOpen(false);
                      }}
                      className="px-4 py-3 text-left transition hover:bg-[#eefafa]"
                    >
                      Nuovo pagamento
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlannedModalOpen(true);
                        setIsAddMenuOpen(false);
                      }}
                      className="px-4 py-3 text-left transition hover:bg-[#eefafa]"
                    >
                      Nuovo pagamento periodico
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={loadTransactions}
                className="h-11 w-fit rounded-md bg-[#17202f] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2a3547] focus:outline-none focus:ring-2 focus:ring-[#0f8f8c] focus:ring-offset-2"
              >
                Aggiorna
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Transazioni" value={filteredTransactions.length} />
            <Metric
              label="Totale speso"
              value={currencyFormatter.format(totalAmount)}
            />
            <Metric
              label="Operazioni lette"
              value={`${parsedCount}/${filteredTransactions.length}`}
            />
            <ForecastMetric forecast={forecast} />
          </div>

          {forecast ? <ForecastPanel forecast={forecast} /> : null}
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-7 sm:px-8 lg:px-10">
        <div className="flex flex-col justify-between gap-2 border-b border-[#dbe3ee] pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold">Lista movimenti</h2>
            <p className="mt-1 text-sm text-[#657386]">
              Aggiornamento automatico ogni ora, o manualmente con il tasto Aggiorna.
            </p>
          </div>
          <StatusBadge loadState={loadState} lastUpdatedAt={lastUpdatedAt} />
        </div>

        <div className="grid gap-3 rounded-md border border-[#dbe3ee] bg-white p-4 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <DateField
            id="date-from"
            label="Da"
            value={dateFrom}
            onChange={setDateFrom}
            max={dateTo}
          />
          <DateField
            id="date-to"
            label="A"
            value={dateTo}
            onChange={setDateTo}
            min={dateFrom}
          />
          <button
            type="button"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
            disabled={!hasActiveDateFilter}
            className="h-11 rounded-md border border-[#cad4e1] px-4 text-sm font-semibold text-[#17202f] transition hover:border-[#0f8f8c] hover:bg-[#eefafa] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Pulisci
          </button>
        </div>

        {transactions.length === 0 ? (
          <EmptyState loadState={loadState} />
        ) : filteredTransactions.length === 0 ? (
          <NoResultsState />
        ) : (
          <div className="grid gap-6">
            {transactionGroups.map((group) => (
              <section key={group.dayKey} className="grid gap-3">
                <div className="sticky top-0 z-10 flex flex-col justify-between gap-2 border-y border-[#dbe3ee] bg-[#f3f6fb]/95 py-3 backdrop-blur sm:flex-row sm:items-center">
                  <h3 className="text-sm font-semibold uppercase text-[#657386]">
                    {group.dayLabel}
                  </h3>
                  <p className="text-sm font-semibold tabular-nums text-[#c45a2b]">
                    Totale giorno {currencyFormatter.format(group.total)}
                  </p>
                </div>

                {group.transactions.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    isMenuOpen={openActionId === transaction.id}
                    onToggleMenu={() =>
                      setOpenActionId(
                        openActionId === transaction.id ? null : transaction.id
                      )
                    }
                    onEdit={() => {
                      setEditingTransaction(transaction);
                      setOpenActionId(null);
                    }}
                    onDelete={() => handleDeleteTransaction(transaction)}
                  />
                ))}
              </section>
            ))}
          </div>
        )}
      </section>

      {isManualModalOpen ? (
        <ManualTransactionModal
          onClose={() => setIsManualModalOpen(false)}
          onSaved={loadTransactions}
        />
      ) : null}

      {isPlannedModalOpen ? (
        <PlannedExpenseModal
          plannedExpenses={plannedExpenses}
          onClose={() => setIsPlannedModalOpen(false)}
          onSaved={loadPlannedExpenses}
        />
      ) : null}

      {editingTransaction ? (
        <EditTransactionModal
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSaved={async () => {
            setEditingTransaction(null);
            await loadTransactions();
          }}
        />
      ) : null}

      {isSettingsModalOpen ? (
        <SettingsModal
          settings={settings}
          onClose={() => setIsSettingsModalOpen(false)}
          onSaved={async (nextSettings) => {
            setIsSettingsModalOpen(false);
            await handleSettingsSaved(nextSettings);
          }}
        />
      ) : null}
    </main>
  );
}

function groupTransactionsByDay(transactions: ParsedTransaction[]) {
  const groups = new Map<string, TransactionGroup>();
  const sortedTransactions = [...transactions].sort((first, second) => {
    return getTransactionTime(second) - getTransactionTime(first);
  });

  for (const transaction of sortedTransactions) {
    const dateValue = transaction.occurredAt ?? transaction.createdAt;
    const date = new Date(dateValue);
    const dayKey = getLocalDayKey(date);
    const existingGroup = groups.get(dayKey);

    if (existingGroup) {
      existingGroup.total += Math.abs(transaction.amount ?? 0);
      existingGroup.transactions.push(transaction);
      continue;
    }

    groups.set(dayKey, {
      dayKey,
      dayLabel: dayFormatter.format(date),
      total: Math.abs(transaction.amount ?? 0),
      transactions: [transaction],
    });
  }

  return Array.from(groups.values());
}

function filterTransactionsByDateRange(
  transactions: ParsedTransaction[],
  dateFrom: string,
  dateTo: string
) {
  return transactions.filter((transaction) => {
    const transactionDay = getTransactionDayKey(transaction);

    if (dateFrom && transactionDay < dateFrom) {
      return false;
    }

    if (dateTo && transactionDay > dateTo) {
      return false;
    }

    return true;
  });
}

function calculateForecast(
  transactions: ParsedTransaction[],
  settings: TrackerSettings,
  plannedExpenses: PlannedExpense[]
): Forecast {
  const today = getTodayDateKey();
  const salaryTransactions = filterTransactionsByDateRange(
    transactions,
    settings.salaryAnchorDate,
    today
  );
  const periodSpent = salaryTransactions.reduce(
    (total, transaction) => total + (transaction.amount ?? 0),
    0
  );
  const elapsedDays = Math.max(
    1,
    daysBetween(settings.salaryAnchorDate, today) + 1
  );
  const dailyAverage = periodSpent / elapsedDays;
  const projectedThirtyDays = dailyAverage * 30;
  const plannedUpcoming = getVisiblePlannedExpenses(plannedExpenses).reduce(
    (total, expense) => total + expense.amount,
    0
  );
  const projectedWithPlanned = projectedThirtyDays + plannedUpcoming;
  const availableBudget = settings.monthlyIncome - settings.savingsGoal;

  return {
    periodSpent,
    dailyAverage,
    projectedThirtyDays,
    plannedUpcoming,
    projectedWithPlanned,
    availableBudget,
    delta: availableBudget - projectedWithPlanned,
    elapsedDays,
  };
}

function getVisiblePlannedExpenses(plannedExpenses: PlannedExpense[]) {
  const today = new Date(`${getTodayDateKey()}T00:00:00`);

  return plannedExpenses.filter((expense) => {
    const dueDate = getMonthlyDueDate(today, expense.dayOfMonth);
    const startsAt = new Date(dueDate);

    startsAt.setDate(startsAt.getDate() - 5);

    return today >= startsAt && today <= dueDate;
  });
}

function getMonthlyDueDate(today: Date, dayOfMonth: number) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const safeDay = Math.min(dayOfMonth, lastDay);

  return new Date(year, month, safeDay);
}

function daysBetween(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const dayInMs = 24 * 60 * 60 * 1000;

  return Math.floor((endDate.getTime() - startDate.getTime()) / dayInMs);
}

function getTransactionDayKey(transaction: ParsedTransaction) {
  return getLocalDayKey(
    new Date(transaction.occurredAt ?? transaction.createdAt)
  );
}

function getTransactionTime(transaction: ParsedTransaction) {
  return new Date(transaction.occurredAt ?? transaction.createdAt).getTime();
}

function getLocalDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayDateKey() {
  return getLocalDayKey(new Date());
}

function getSalaryPeriodStartDateKey() {
  const today = new Date();
  const startDate = new Date(today);

  startDate.setDate(20);

  if (today.getDate() < 20) {
    startDate.setMonth(startDate.getMonth() - 1);
  }

  return getLocalDayKey(startDate);
}

function getCurrentTimeKey() {
  const now = new Date();
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");

  return `${hour}:${minute}`;
}

function splitDateTime(value: string | null) {
  const date = value ? new Date(value) : new Date();

  return {
    date: getLocalDayKey(date),
    time: `${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes()
    ).padStart(2, "0")}`,
  };
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-[#dbe3ee] bg-white px-4 py-4 shadow-sm">
      <p className="text-sm font-medium text-[#657386]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ForecastMetric({ forecast }: { forecast: Forecast | null }) {
  const label = forecast && forecast.delta >= 0 ? "Sei sotto" : "Sei sopra";
  const value = forecast
    ? currencyFormatter.format(Math.abs(forecast.delta))
    : "In calcolo";

  return <Metric label={label} value={value} />;
}

function ForecastPanel({ forecast }: { forecast: Forecast }) {
  const isUnderBudget = forecast.delta >= 0;

  return (
    <div className="grid gap-3 rounded-md border border-[#dbe3ee] bg-white p-4 shadow-sm sm:grid-cols-4">
      <div>
        <p className="text-sm font-medium text-[#657386]">Media giornaliera</p>
        <p className="mt-2 text-xl font-semibold">
          {currencyFormatter.format(forecast.dailyAverage)}
        </p>
      </div>
      <div>
        <p className="text-sm font-medium text-[#657386]">Previsione 30 giorni</p>
        <p className="mt-2 text-xl font-semibold">
          {currencyFormatter.format(forecast.projectedThirtyDays)}
        </p>
      </div>
      <div>
        <p className="text-sm font-medium text-[#657386]">Previsti ora</p>
        <p className="mt-2 text-xl font-semibold">
          {currencyFormatter.format(forecast.plannedUpcoming)}
        </p>
      </div>
      <div>
        <p className="text-sm font-medium text-[#657386]">Obiettivo risparmio</p>
        <p
          className={`mt-2 text-xl font-semibold ${
            isUnderBudget ? "text-[#0b7471]" : "text-[#c45a2b]"
          }`}
        >
          {isUnderBudget ? "In linea" : "Da rallentare"}
        </p>
      </div>
    </div>
  );
}

function DateField({
  id,
  label,
  value,
  onChange,
  min,
  max,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    <label htmlFor={id} className="grid gap-2">
      <span className="text-sm font-semibold text-[#657386]">{label}</span>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-[#cad4e1] bg-[#fbfcff] px-3 text-sm font-semibold text-[#17202f] outline-none transition focus:border-[#0f8f8c] focus:ring-2 focus:ring-[#0f8f8c]/20"
      />
    </label>
  );
}

function ManualTransactionModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [recipient, setRecipient] = useState("");
  const [date, setDate] = useState(getTodayDateKey());
  const [time, setTime] = useState(getCurrentTimeKey());
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!recipient.trim() || !date || !time || !amount) {
      setError("Compila destinatario, data, ora e importo.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "manual",
          recipient,
          amount,
          occurredAt: `${date}T${time}:00`,
        }),
      });

      if (!response.ok) {
        throw new Error("Save failed");
      }

      await onSaved();
      onClose();
    } catch {
      setError("Non sono riuscito a salvare il pagamento.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <TransactionModalShell
      title="Nuovo pagamento"
      description="Inserisci un movimento manuale nella lista."
      onClose={onClose}
    >
      <TransactionForm
        amount={amount}
        date={date}
        error={error}
        isSaving={isSaving}
        recipient={recipient}
        submitLabel="Salva pagamento"
        time={time}
        onAmountChange={setAmount}
        onCancel={onClose}
        onDateChange={setDate}
        onRecipientChange={setRecipient}
        onSubmit={handleSubmit}
        onTimeChange={setTime}
      />
    </TransactionModalShell>
  );
}

function EditTransactionModal({
  transaction,
  onClose,
  onSaved,
}: {
  transaction: ParsedTransaction;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const initialDateTime = splitDateTime(transaction.occurredAt);
  const [recipient, setRecipient] = useState(transaction.recipient);
  const [date, setDate] = useState(initialDateTime.date);
  const [time, setTime] = useState(initialDateTime.time);
  const [amount, setAmount] = useState(String(transaction.amount ?? ""));
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!recipient.trim() || !date || !time || !amount) {
      setError("Compila destinatario, data, ora e importo.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient,
          amount,
          occurredAt: `${date}T${time}:00`,
        }),
      });

      if (!response.ok) {
        throw new Error("Save failed");
      }

      await onSaved();
    } catch {
      setError("Non sono riuscito a modificare il pagamento.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <TransactionModalShell
      title="Modifica pagamento"
      description="Aggiorna i dati salvati su Supabase."
      onClose={onClose}
    >
      <TransactionForm
        amount={amount}
        date={date}
        error={error}
        isSaving={isSaving}
        recipient={recipient}
        submitLabel="Salva modifiche"
        time={time}
        onAmountChange={setAmount}
        onCancel={onClose}
        onDateChange={setDate}
        onRecipientChange={setRecipient}
        onSubmit={handleSubmit}
        onTimeChange={setTime}
      />
    </TransactionModalShell>
  );
}

function TransactionModalShell({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-[#17202f]/45 px-4 py-5 sm:items-center sm:justify-center">
      <div className="w-full max-w-lg rounded-md border border-[#dbe3ee] bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-[#657386]">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-md border border-[#cad4e1] text-lg font-semibold transition hover:bg-[#f3f6fb]"
            aria-label="Chiudi"
          >
            x
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

function TransactionForm({
  amount,
  date,
  error,
  isSaving,
  recipient,
  submitLabel,
  time,
  onAmountChange,
  onCancel,
  onDateChange,
  onRecipientChange,
  onSubmit,
  onTimeChange,
}: {
  amount: string;
  date: string;
  error: string;
  isSaving: boolean;
  recipient: string;
  submitLabel: string;
  time: string;
  onAmountChange: (value: string) => void;
  onCancel: () => void;
  onDateChange: (value: string) => void;
  onRecipientChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTimeChange: (value: string) => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <div className="mt-5 grid gap-4">
        <TextField
          id="transaction-recipient"
          label="Destinatario"
          value={recipient}
          onChange={onRecipientChange}
          placeholder="Es. FIRMOO"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <DateField
            id="transaction-date"
            label="Data"
            value={date}
            onChange={onDateChange}
          />
          <label htmlFor="transaction-time" className="grid gap-2">
            <span className="text-sm font-semibold text-[#657386]">Ora</span>
            <input
              id="transaction-time"
              type="time"
              value={time}
              onChange={(event) => onTimeChange(event.target.value)}
              className="h-11 rounded-md border border-[#cad4e1] bg-[#fbfcff] px-3 text-sm font-semibold text-[#17202f] outline-none transition focus:border-[#0f8f8c] focus:ring-2 focus:ring-[#0f8f8c]/20"
            />
          </label>
        </div>

        <label htmlFor="transaction-amount" className="grid gap-2">
          <span className="text-sm font-semibold text-[#657386]">Importo</span>
          <input
            id="transaction-amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => onAmountChange(event.target.value)}
            placeholder="34.77"
            className="h-11 rounded-md border border-[#cad4e1] bg-[#fbfcff] px-3 text-sm font-semibold text-[#17202f] outline-none transition focus:border-[#0f8f8c] focus:ring-2 focus:ring-[#0f8f8c]/20"
          />
        </label>

        {error ? (
          <p className="rounded-md bg-[#ffe1d6] px-3 py-2 text-sm font-semibold text-[#a13d19]">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 rounded-md border border-[#cad4e1] px-4 text-sm font-semibold transition hover:bg-[#f3f6fb]"
        >
          Annulla
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="h-11 rounded-md bg-[#0f8f8c] px-4 text-sm font-semibold text-white transition hover:bg-[#0b7471] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Salvataggio..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function SettingsModal({
  settings,
  onClose,
  onSaved,
}: {
  settings: TrackerSettings | null;
  onClose: () => void;
  onSaved: (settings: TrackerSettings) => Promise<void>;
}) {
  const [salaryAnchorDate, setSalaryAnchorDate] = useState(
    settings?.salaryAnchorDate ?? getSalaryPeriodStartDateKey()
  );
  const [monthlyIncome, setMonthlyIncome] = useState(
    String(settings?.monthlyIncome ?? 1930)
  );
  const [savingsGoal, setSavingsGoal] = useState(
    String(settings?.savingsGoal ?? 300)
  );
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          salaryAnchorDate,
          monthlyIncome,
          savingsGoal,
        }),
      });

      if (!response.ok) {
        throw new Error("Save failed");
      }

      const data = (await response.json()) as {
        settings: TrackerSettings;
      };

      await onSaved(data.settings);
    } catch {
      setError("Non sono riuscito a salvare le impostazioni.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <TransactionModalShell
      title="Impostazioni stipendio"
      description="Scegli inizio mese fiscale, stipendio e obiettivo risparmio."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <div className="mt-5 grid gap-4">
          <DateField
            id="salary-date"
            label="Data arrivo stipendio"
            value={salaryAnchorDate}
            onChange={setSalaryAnchorDate}
          />
          <label htmlFor="monthly-income" className="grid gap-2">
            <span className="text-sm font-semibold text-[#657386]">
              Stipendio mensile
            </span>
            <input
              id="monthly-income"
              type="number"
              min="0"
              step="0.01"
              value={monthlyIncome}
              onChange={(event) => setMonthlyIncome(event.target.value)}
              className="h-11 rounded-md border border-[#cad4e1] bg-[#fbfcff] px-3 text-sm font-semibold text-[#17202f] outline-none transition focus:border-[#0f8f8c] focus:ring-2 focus:ring-[#0f8f8c]/20"
            />
          </label>
          <label htmlFor="savings-goal" className="grid gap-2">
            <span className="text-sm font-semibold text-[#657386]">
              Risparmio desiderato
            </span>
            <input
              id="savings-goal"
              type="number"
              min="0"
              step="0.01"
              value={savingsGoal}
              onChange={(event) => setSavingsGoal(event.target.value)}
              className="h-11 rounded-md border border-[#cad4e1] bg-[#fbfcff] px-3 text-sm font-semibold text-[#17202f] outline-none transition focus:border-[#0f8f8c] focus:ring-2 focus:ring-[#0f8f8c]/20"
            />
          </label>

          {error ? (
            <p className="rounded-md bg-[#ffe1d6] px-3 py-2 text-sm font-semibold text-[#a13d19]">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-md border border-[#cad4e1] px-4 text-sm font-semibold transition hover:bg-[#f3f6fb]"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="h-11 rounded-md bg-[#0f8f8c] px-4 text-sm font-semibold text-white transition hover:bg-[#0b7471] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Salvataggio..." : "Salva impostazioni"}
          </button>
        </div>
      </form>
    </TransactionModalShell>
  );
}

function PlannedExpenseModal({
  plannedExpenses,
  onClose,
  onSaved,
}: {
  plannedExpenses: PlannedExpense[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [editingExpense, setEditingExpense] = useState<PlannedExpense | null>(
    null
  );
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("15");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function startEdit(expense: PlannedExpense) {
    setEditingExpense(expense);
    setRecipient(expense.recipient);
    setAmount(String(expense.amount));
    setDayOfMonth(String(expense.dayOfMonth));
    setError("");
  }

  function resetForm() {
    setEditingExpense(null);
    setRecipient("");
    setAmount("");
    setDayOfMonth("15");
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!recipient.trim() || !amount || !dayOfMonth) {
      setError("Compila destinatario, importo e giorno del mese.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        editingExpense
          ? `/api/planned-expenses/${editingExpense.id}`
          : "/api/planned-expenses",
        {
          method: editingExpense ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient,
            amount,
            dayOfMonth,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Save failed");
      }

      resetForm();
      await onSaved();
    } catch {
      setError("Non sono riuscito a salvare il pagamento periodico.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(expense: PlannedExpense) {
    const confirmed = window.confirm(
      `Rimuovere il pagamento periodico "${expense.recipient}"?`
    );

    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/planned-expenses/${expense.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      resetForm();
      await onSaved();
    }
  }

  return (
    <TransactionModalShell
      title="Pagamenti periodici"
      description="Aggiungi rate e spese ricorrenti da considerare nella previsione."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <div className="mt-5 grid gap-4">
          <TextField
            id="planned-recipient"
            label="Destinatario"
            value={recipient}
            onChange={setRecipient}
            placeholder="Es. finanziamento auto"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <label htmlFor="planned-amount" className="grid gap-2">
              <span className="text-sm font-semibold text-[#657386]">
                Importo
              </span>
              <input
                id="planned-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="120.00"
                className="h-11 rounded-md border border-[#cad4e1] bg-[#fbfcff] px-3 text-sm font-semibold text-[#17202f] outline-none transition focus:border-[#0f8f8c] focus:ring-2 focus:ring-[#0f8f8c]/20"
              />
            </label>
            <label htmlFor="planned-day" className="grid gap-2">
              <span className="text-sm font-semibold text-[#657386]">
                Giorno del mese
              </span>
              <input
                id="planned-day"
                type="number"
                min="1"
                max="31"
                step="1"
                value={dayOfMonth}
                onChange={(event) => setDayOfMonth(event.target.value)}
                className="h-11 rounded-md border border-[#cad4e1] bg-[#fbfcff] px-3 text-sm font-semibold text-[#17202f] outline-none transition focus:border-[#0f8f8c] focus:ring-2 focus:ring-[#0f8f8c]/20"
              />
            </label>
          </div>

          {error ? (
            <p className="rounded-md bg-[#ffe1d6] px-3 py-2 text-sm font-semibold text-[#a13d19]">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {editingExpense ? (
            <button
              type="button"
              onClick={resetForm}
              className="h-11 rounded-md border border-[#cad4e1] px-4 text-sm font-semibold transition hover:bg-[#f3f6fb]"
            >
              Nuovo
            </button>
          ) : null}
          <button
            type="submit"
            disabled={isSaving}
            className="h-11 rounded-md bg-[#0f8f8c] px-4 text-sm font-semibold text-white transition hover:bg-[#0b7471] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving
              ? "Salvataggio..."
              : editingExpense
                ? "Salva modifiche"
                : "Salva periodico"}
          </button>
        </div>
      </form>

      <div className="mt-6 grid gap-2 border-t border-[#dbe3ee] pt-4">
        <h3 className="text-sm font-semibold uppercase text-[#657386]">
          Gia previsti
        </h3>
        {plannedExpenses.length === 0 ? (
          <p className="text-sm text-[#657386]">
            Nessun pagamento periodico salvato.
          </p>
        ) : (
          plannedExpenses.map((expense) => (
            <div
              key={expense.id}
              className="grid gap-2 rounded-md border border-[#dbe3ee] bg-[#fbfcff] p-3 sm:grid-cols-[1fr_auto]"
            >
              <div>
                <p className="font-semibold">{expense.recipient}</p>
                <p className="mt-1 text-sm text-[#657386]">
                  Ogni {expense.dayOfMonth} del mese -{" "}
                  {currencyFormatter.format(expense.amount)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(expense)}
                  className="rounded-md border border-[#cad4e1] px-3 py-2 text-sm font-semibold transition hover:bg-white"
                >
                  Modifica
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(expense)}
                  className="rounded-md border border-[#f1b9a7] px-3 py-2 text-sm font-semibold text-[#a13d19] transition hover:bg-[#ffe1d6]"
                >
                  Elimina
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </TransactionModalShell>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label htmlFor={id} className="grid gap-2">
      <span className="text-sm font-semibold text-[#657386]">{label}</span>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-md border border-[#cad4e1] bg-[#fbfcff] px-3 text-sm font-semibold text-[#17202f] outline-none transition focus:border-[#0f8f8c] focus:ring-2 focus:ring-[#0f8f8c]/20"
      />
    </label>
  );
}

function TransactionRow({
  transaction,
  isMenuOpen,
  onDelete,
  onEdit,
  onToggleMenu,
}: {
  transaction: ParsedTransaction;
  isMenuOpen: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onToggleMenu: () => void;
}) {
  const isIncome = transaction.amount !== null && transaction.amount < 0;
  const amountLabel =
  transaction.amount === null
    ? "Importo non letto"
    : `${isIncome ? "+" : "-"} ${currencyFormatter.format(Math.abs(transaction.amount))}`;
  const dateLabel = transaction.occurredAt
    ? dateFormatter.format(new Date(transaction.occurredAt))
    : "Data non letta";

  return (
    <article className="relative grid gap-4 rounded-md border border-[#dbe3ee] bg-white p-4 pr-12 shadow-sm transition hover:border-[#9fcfce] hover:shadow-md sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="break-words text-lg font-semibold">
            {transaction.recipient}
          </h3>
          {transaction.status === "unparsed" ? (
            <span className="rounded-sm bg-[#fff0cf] px-2 py-1 text-xs font-semibold text-[#8b5b00]">
              Da verificare
            </span>
          ) : null}
          <SourceBadge source={transaction.source} />
        </div>
        <p className="mt-2 text-sm text-[#657386]">{dateLabel}</p>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#7a8797]">
          {transaction.rawMessage}
        </p>
      </div>

      <p className={`text-left text-2xl font-semibold tabular-nums sm:text-right ${isIncome ? "text-[#0b7471]" : "text-[#c45a2b]"}`}>
      {amountLabel}
      </p>

      <div className="absolute right-3 top-3">
        <button
          type="button"
          onClick={onToggleMenu}
          className="h-9 w-9 rounded-md text-lg font-semibold text-[#657386] transition hover:bg-[#f3f6fb]"
          aria-label="Azioni transazione"
        >
          ...
        </button>
        {isMenuOpen ? (
          <div className="absolute right-0 z-20 mt-1 grid min-w-32 overflow-hidden rounded-md border border-[#dbe3ee] bg-white text-sm font-semibold shadow-lg">
            <button
              type="button"
              onClick={onEdit}
              className="px-4 py-2 text-left transition hover:bg-[#eefafa]"
            >
              Modifica
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="px-4 py-2 text-left text-[#a13d19] transition hover:bg-[#ffe1d6]"
            >
              Elimina
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function SourceBadge({ source }: { source: ParsedTransaction["source"] }) {
  const label =
    source === "email" ? "Email" : source === "manual" ? "Manuale" : "SMS";

  return (
    <span className="rounded-sm bg-[#eaf0f7] px-2 py-1 text-xs font-semibold text-[#526175]">
      {label}
    </span>
  );
}

function NoResultsState() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-md border border-dashed border-[#cad4e1] bg-white px-6 text-center">
      <p className="text-lg font-semibold">Nessun pagamento in questo intervallo</p>
      <p className="mt-3 max-w-md text-sm leading-6 text-[#657386]">
        Modifica le date o pulisci il filtro per tornare alla lista completa.
      </p>
    </div>
  );
}

function StatusBadge({
  loadState,
  lastUpdatedAt,
}: {
  loadState: LoadState;
  lastUpdatedAt: Date | null;
}) {
  if (loadState === "error") {
    return (
      <span className="w-fit rounded-md bg-[#ffe1d6] px-3 py-2 text-sm font-semibold text-[#a13d19]">
        Connessione API non riuscita
      </span>
    );
  }

  const label =
    loadState === "loading"
      ? "Caricamento"
      : lastUpdatedAt
        ? `Ultimo sync ${lastUpdatedAt.toLocaleTimeString("it-IT", {
            hour: "2-digit",
            minute: "2-digit",
          })}`
        : "In attesa";

  return (
    <span className="w-fit rounded-md bg-[#dff4f3] px-3 py-2 text-sm font-semibold text-[#0b7471]">
      {label}
    </span>
  );
}

function EmptyState({ loadState }: { loadState: LoadState }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-md border border-dashed border-[#cad4e1] bg-white px-6 text-center">
      <p className="text-lg font-semibold">
        {loadState === "loading"
          ? "Sto leggendo le transazioni..."
          : "Nessuna transazione ricevuta"}
      </p>
      <p className="mt-3 max-w-md text-sm leading-6 text-[#657386]">
        Invia dall&apos;automazione iPhone un POST a{" "}
        <span className="font-mono text-[#17202f]">/api/transactions</span> con{" "}
        <span className="font-mono text-[#17202f]">rawMessage</span>. Appena
        arriva, comparira in questa lista.
      </p>
    </div>
  );
}
