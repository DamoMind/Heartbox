import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  History as HistoryIcon,
} from 'lucide-react';
import { Card, Select, Badge } from '@/components/ui';
import { useTransactions, useInventory } from '@/hooks/useInventory';
import { Transaction, TransactionType } from '@/types';
import { clsx } from 'clsx';

export function History() {
  const { t } = useTranslation();
  const { transactions, loading } = useTransactions(100);
  const { items } = useInventory();
  const [filterType, setFilterType] = useState<TransactionType | 'all'>('all');

  // Create item lookup map
  const itemMap = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach(item => map.set(item.id, item.name));
    return map;
  }, [items]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    if (filterType === 'all') return transactions;
    return transactions.filter(tx => tx.type === filterType);
  }, [transactions, filterType]);

  // Group by date
  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, Transaction[]>();

    filteredTransactions.forEach(tx => {
      const date = tx.performedAt.split('T')[0];
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)!.push(tx);
    });

    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredTransactions]);

  const formatDateHeader = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMM d');
  };

  const filterOptions = [
    { value: 'all', label: t('history.filterAll') },
    { value: 'in', label: t('history.filterInbound') },
    { value: 'out', label: t('history.filterOutbound') },
  ];

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-bold text-slate-800">{t('history.title')}</h1>
        <Select
          options={filterOptions}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as TransactionType | 'all')}
          className="w-36"
        />
      </div>

      {/* Transaction List */}
      {groupedTransactions.length === 0 ? (
        <div className="text-center py-12">
          <HistoryIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{t('history.noHistory')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedTransactions.map(([date, txs]) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-slate-500 mb-2 px-1">
                {formatDateHeader(date)}
              </h3>
              <div className="space-y-2">
                {txs.map((tx) => {
                  const itemName = itemMap.get(tx.itemId) || 'Unknown Item';
                  const isInbound = tx.type === 'in';

                  return (
                    <Card key={tx.id} padding="sm">
                      <div className="flex items-center gap-3">
                        {/* Icon */}
                        <div
                          className={clsx(
                            'w-10 h-10 rounded-xl flex items-center justify-center',
                            isInbound ? 'bg-success-50' : 'bg-primary-50'
                          )}
                        >
                          {isInbound ? (
                            <ArrowDownToLine className="h-5 w-5 text-success-500" />
                          ) : (
                            <ArrowUpFromLine className="h-5 w-5 text-primary-500" />
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-800 truncate">
                              {itemName}
                            </p>
                            <Badge variant={isInbound ? 'success' : 'info'}>
                              {isInbound ? '+' : '-'}{tx.quantity}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-500 truncate">
                            {tx.reason}
                            {tx.recipientInfo && ` • ${tx.recipientInfo}`}
                          </p>
                        </div>

                        {/* Time */}
                        <p className="text-xs text-slate-400">
                          {format(parseISO(tx.performedAt), 'HH:mm')}
                        </p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
