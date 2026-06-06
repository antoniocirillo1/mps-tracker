"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
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

export default function TransactionsDashboard() {
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

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

  useEffect(() => {
    const timeoutId = window.setTimeout(loadTransactions, 0);
    const intervalId = window.setInterval(loadTransactions, 5000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [loadTransactions]);

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

  return (
    <main className="min-h-screen bg-[#f7f5f0] text-[#171512]">
      <section className="border-b border-[#ded8cf] bg-[#fffdf8]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase text-[#8b1e1e]">
                Banca MPS tracker
              </p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
                Spese ricevute via SMS
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[#655f57]">
                Ogni chiamata dell&apos;automazione iPhone viene salvata qui in
                memoria locale e divisa in importo, ricevente e data/ora.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsManualModalOpen(true)}
                className="h-11 rounded-md bg-[#8b1e1e] px-4 text-xl font-semibold leading-none text-white transition hover:bg-[#6f1717] focus:outline-none focus:ring-2 focus:ring-[#8b1e1e] focus:ring-offset-2"
                aria-label="Aggiungi pagamento manuale"
              >
                +
              </button>
              <button
                type="button"
                onClick={loadTransactions}
                className="h-11 w-fit rounded-md bg-[#171512] px-5 text-sm font-semibold text-white transition hover:bg-[#37322d] focus:outline-none focus:ring-2 focus:ring-[#8b1e1e] focus:ring-offset-2"
              >
                Aggiorna
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Transazioni" value={filteredTransactions.length} />
            <Metric
              label="Totale speso"
              value={currencyFormatter.format(totalAmount)}
            />
            <Metric
              label="SMS letti"
              value={`${parsedCount}/${filteredTransactions.length}`}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-7 sm:px-8 lg:px-10">
        <div className="flex flex-col justify-between gap-2 border-b border-[#ded8cf] pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold">Lista movimenti</h2>
            <p className="mt-1 text-sm text-[#655f57]">
              Aggiornamento automatico ogni 5 secondi.
            </p>
          </div>
          <StatusBadge loadState={loadState} lastUpdatedAt={lastUpdatedAt} />
        </div>

        <div className="grid gap-3 rounded-md border border-[#ded8cf] bg-[#fffdf8] p-4 shadow-sm sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
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
              setDateFrom("1980-01-01");
              setDateTo(getTodayDateKey());
            }}
            className="h-11 rounded-md bg-[#171512] px-4 text-sm font-semibold text-white transition hover:bg-[#37322d] focus:outline-none focus:ring-2 focus:ring-[#8b1e1e] focus:ring-offset-2"
          >
            SEMPRE
          </button>
          <button
            type="button"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
            disabled={!hasActiveDateFilter}
            className="h-11 rounded-md border border-[#c7b9a8] px-4 text-sm font-semibold text-[#171512] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
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
                <div className="sticky top-0 z-10 flex flex-col justify-between gap-2 border-y border-[#ded8cf] bg-[#f7f5f0]/95 py-3 backdrop-blur sm:flex-row sm:items-center">
                  <h3 className="text-sm font-semibold uppercase text-[#655f57]">
                    {group.dayLabel}
                  </h3>
                  <p className="text-sm font-semibold tabular-nums text-[#8b1e1e]">
                    Totale giorno {currencyFormatter.format(group.total)}
                  </p>
                </div>

                {group.transactions.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
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
      existingGroup.total += transaction.amount ?? 0;
      existingGroup.transactions.push(transaction);
      continue;
    }

    groups.set(dayKey, {
      dayKey,
      dayLabel: dayFormatter.format(date),
      total: transaction.amount ?? 0,
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

function getCurrentTimeKey() {
  const now = new Date();
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");

  return `${hour}:${minute}`;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-[#ded8cf] bg-white px-4 py-4 shadow-sm">
      <p className="text-sm font-medium text-[#655f57]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
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
      <span className="text-sm font-semibold text-[#655f57]">{label}</span>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-[#c7b9a8] bg-white px-3 text-sm font-semibold text-[#171512] outline-none transition focus:border-[#8b1e1e] focus:ring-2 focus:ring-[#8b1e1e]/20"
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
    <div className="fixed inset-0 z-30 flex items-end bg-black/35 px-4 py-5 sm:items-center sm:justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-md border border-[#ded8cf] bg-[#fffdf8] p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Nuovo pagamento</h2>
            <p className="mt-1 text-sm text-[#655f57]">
              Inserisci un movimento manuale nella lista.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-md border border-[#c7b9a8] text-lg font-semibold transition hover:bg-white"
            aria-label="Chiudi"
          >
            x
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <TextField
            id="manual-recipient"
            label="Destinatario"
            value={recipient}
            onChange={setRecipient}
            placeholder="Es. FIRMOO"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <DateField
              id="manual-date"
              label="Data"
              value={date}
              onChange={setDate}
            />
            <label htmlFor="manual-time" className="grid gap-2">
              <span className="text-sm font-semibold text-[#655f57]">Ora</span>
              <input
                id="manual-time"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="h-11 rounded-md border border-[#c7b9a8] bg-white px-3 text-sm font-semibold text-[#171512] outline-none transition focus:border-[#8b1e1e] focus:ring-2 focus:ring-[#8b1e1e]/20"
              />
            </label>
          </div>

          <label htmlFor="manual-amount" className="grid gap-2">
            <span className="text-sm font-semibold text-[#655f57]">Importo</span>
            <input
              id="manual-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="34.77"
              className="h-11 rounded-md border border-[#c7b9a8] bg-white px-3 text-sm font-semibold text-[#171512] outline-none transition focus:border-[#8b1e1e] focus:ring-2 focus:ring-[#8b1e1e]/20"
            />
          </label>

          {error ? (
            <p className="rounded-md bg-[#f7d7d7] px-3 py-2 text-sm font-semibold text-[#8b1e1e]">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-md border border-[#c7b9a8] px-4 text-sm font-semibold transition hover:bg-white"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="h-11 rounded-md bg-[#8b1e1e] px-4 text-sm font-semibold text-white transition hover:bg-[#6f1717] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Salvataggio..." : "Salva pagamento"}
          </button>
        </div>
      </form>
    </div>
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
      <span className="text-sm font-semibold text-[#655f57]">{label}</span>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-md border border-[#c7b9a8] bg-white px-3 text-sm font-semibold text-[#171512] outline-none transition focus:border-[#8b1e1e] focus:ring-2 focus:ring-[#8b1e1e]/20"
      />
    </label>
  );
}

function TransactionRow({
  transaction,
}: {
  transaction: ParsedTransaction;
}) {
  const amountLabel =
    transaction.amount === null
      ? "Importo non letto"
      : currencyFormatter.format(transaction.amount);
  const dateLabel = transaction.occurredAt
    ? dateFormatter.format(new Date(transaction.occurredAt))
    : "Data non letta";

  return (
    <article className="grid gap-4 rounded-md border border-[#ded8cf] bg-white p-4 shadow-sm transition hover:border-[#c7b9a8] sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="break-words text-lg font-semibold">
            {transaction.recipient}
          </h3>
          {transaction.status === "unparsed" ? (
            <span className="rounded-sm bg-[#fff0d8] px-2 py-1 text-xs font-semibold text-[#8b4b00]">
              Da verificare
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-[#655f57]">{dateLabel}</p>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#7c756d]">
          {transaction.rawMessage}
        </p>
      </div>

      <p className="text-left text-2xl font-semibold tabular-nums text-[#8b1e1e] sm:text-right">
        {amountLabel}
      </p>
    </article>
  );
}

function NoResultsState() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-md border border-dashed border-[#c7b9a8] bg-[#fffdf8] px-6 text-center">
      <p className="text-lg font-semibold">Nessun pagamento in questo intervallo</p>
      <p className="mt-3 max-w-md text-sm leading-6 text-[#655f57]">
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
      <span className="w-fit rounded-md bg-[#f7d7d7] px-3 py-2 text-sm font-semibold text-[#8b1e1e]">
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
    <span className="w-fit rounded-md bg-[#e7f2e4] px-3 py-2 text-sm font-semibold text-[#2d6734]">
      {label}
    </span>
  );
}

function EmptyState({ loadState }: { loadState: LoadState }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-md border border-dashed border-[#c7b9a8] bg-[#fffdf8] px-6 text-center">
      <p className="text-lg font-semibold">
        {loadState === "loading"
          ? "Sto leggendo le transazioni..."
          : "Nessuna transazione ricevuta"}
      </p>
      <p className="mt-3 max-w-md text-sm leading-6 text-[#655f57]">
        Invia dall&apos;automazione iPhone un POST a{" "}
        <span className="font-mono text-[#171512]">/api/transactions</span> con{" "}
        <span className="font-mono text-[#171512]">rawMessage</span>. Appena
        arriva, comparira in questa lista.
      </p>
    </div>
  );
}
