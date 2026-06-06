"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

  const totalAmount = useMemo(
    () =>
      transactions.reduce(
        (total, transaction) => total + (transaction.amount ?? 0),
        0
      ),
    [transactions]
  );

  const parsedCount = transactions.filter(
    (transaction) => transaction.status === "parsed"
  ).length;

  const transactionGroups = useMemo(
    () => groupTransactionsByDay(transactions),
    [transactions]
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

            <button
              type="button"
              onClick={loadTransactions}
              className="h-11 w-fit rounded-md bg-[#171512] px-5 text-sm font-semibold text-white transition hover:bg-[#37322d] focus:outline-none focus:ring-2 focus:ring-[#8b1e1e] focus:ring-offset-2"
            >
              Aggiorna
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Transazioni" value={transactions.length} />
            <Metric
              label="Totale speso"
              value={currencyFormatter.format(totalAmount)}
            />
            <Metric
              label="SMS letti"
              value={`${parsedCount}/${transactions.length}`}
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

        {transactions.length === 0 ? (
          <EmptyState loadState={loadState} />
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

function getTransactionTime(transaction: ParsedTransaction) {
  return new Date(transaction.occurredAt ?? transaction.createdAt).getTime();
}

function getLocalDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-[#ded8cf] bg-white px-4 py-4 shadow-sm">
      <p className="text-sm font-medium text-[#655f57]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
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
