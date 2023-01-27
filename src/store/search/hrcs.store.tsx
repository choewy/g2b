import { DateTime } from 'luxon';
import { SyntheticEvent, useCallback } from 'react';
import {
  HrcsItemRow,
  hrcsTask,
  searchApi,
  SearchCustomQueryType,
  SearchTaskType,
} from '@/apis';
import { KeywordRegExp, StoreInstance } from '@/core';
import { DateFormat, DateChangeEventHandler } from '@/component';
import { AppMessageType, appStore } from '../app';
import { keywordStore } from '../keyword';
import { SearchStoreType } from './types';

export class HrcsSearchStore extends StoreInstance<
  SearchStoreType<SearchTaskType, SearchCustomQueryType, HrcsItemRow>
> {
  useChangeTaskEvent(): (
    text: string,
  ) => (e: SyntheticEvent<Element, Event>, checked: boolean) => void {
    const setState = this.useSetState();

    return useCallback(
      (text) => (_, checked) => {
        const task = hrcsTask.findByText(text);

        if (!task) {
          return;
        }

        if (!task.endPoint && checked) {
          return setState((prev) => ({
            ...prev,
            tasks: hrcsTask.initValues,
          }));
        }

        if (task.endPoint && checked) {
          return setState((prev) => {
            const tasks =
              prev.tasks.length === hrcsTask.otherValues.length - 1
                ? hrcsTask.initValues
                : [...prev.tasks.filter(({ endPoint }) => endPoint), task];

            return { ...prev, tasks };
          });
        }

        if (task.endPoint && !checked) {
          return setState((prev) => {
            const tasks = prev.tasks.filter(({ text }) => text !== task.text);

            return {
              ...prev,
              tasks: tasks.length ? tasks : hrcsTask.initValues,
            };
          });
        }
      },
      [setState],
    );
  }

  useSetDateCallback(key: 'inqryBgnDt' | 'inqryEndDt'): DateChangeEventHandler {
    const setState = this.useSetState();

    return useCallback(
      (datetime) => {
        setState((prev) => {
          let value: string | undefined;

          if (!datetime) {
            value = undefined;
          } else {
            value = datetime.toFormat(DateFormat);
          }

          return { ...prev, query: { ...prev.query, [key]: value } };
        });
      },
      [key, setState],
    );
  }

  private async recursiveApiCall({
    includeRegExp,
    excludeRegExp,
    rows,
    endPoint,
    query,
    setMessage,
  }: {
    includeRegExp?: KeywordRegExp;
    excludeRegExp?: KeywordRegExp;
    rows: HrcsItemRow[];
    endPoint: string;
    query: SearchCustomQueryType;
    setMessage(messages: AppMessageType): Promise<void>;
  }) {
    try {
      let index = rows.length;

      const res = await searchApi.hrcs(endPoint, query);
      const { pageNo, numOfRows, totalCount, items } = res.response.body;

      rows = rows.concat(
        (items || []).reduce<HrcsItemRow[]>((searchedRow, item) => {
          const includeKeywords =
            includeRegExp && item.prdctClsfcNoNm.match(includeRegExp);

          const excludeKeywords = excludeRegExp
            ? [item.prdctClsfcNoNm, item.rlDminsttNm]
                .join()
                .match(excludeRegExp)
            : null;

          if (includeKeywords && !excludeKeywords) {
            index += 1;
            searchedRow.push(new HrcsItemRow(index, includeKeywords[0], item));
          }

          return searchedRow;
        }, []),
      );

      if (totalCount > pageNo * numOfRows) {
        rows = await this.recursiveApiCall({
          rows,
          includeRegExp,
          excludeRegExp,
          endPoint,
          setMessage,
          query: {
            ...query,
            pageNo: pageNo + 1,
          },
        });
      }
    } catch (e) {
      const error = e as any;
      setMessage({ error: error.message });
    }

    return rows;
  }

  useSearchCallback(): () => Promise<void> {
    const [{ tasks, query }, setState] = this.useState();

    const setLoading = appStore.useSetLoading();
    const setMessage = appStore.useSetMessage();

    const keywords = keywordStore.useValue();
    const include = keywords.include || [];
    const exclude = keywords.exclude || [];

    return useCallback(async () => {
      if (!tasks || !query) {
        return setMessage({
          warn: '검색 조건을 다시 확인하세요.',
        });
      }

      let taskTargets: SearchTaskType[];

      if (tasks.length === 1 && !tasks[0].endPoint) {
        taskTargets = hrcsTask.otherValues;
      } else {
        taskTargets = tasks;
      }

      let rows: HrcsItemRow[] = [];

      setLoading(true);

      const includeRegExp = include.length
        ? new KeywordRegExp(include)
        : undefined;

      const excludeRegExp = exclude.length
        ? new KeywordRegExp(exclude)
        : undefined;

      for (const task of taskTargets) {
        rows = await this.recursiveApiCall({
          includeRegExp,
          excludeRegExp,
          query,
          rows,
          endPoint: task.endPoint,
          setMessage,
        });
      }

      setState((prev) => ({
        ...prev,
        rows: rows
          .sort((x, y) => x.검색어.localeCompare(y.검색어))
          .map((row, i) => {
            row.순번 = i + 1;
            return row;
          }),
      }));
      setLoading(false);
      setMessage({ info: `${rows.length}건의 결과가 검색되었습니다.` });
    }, [tasks, query, keywords, setState, setLoading, setMessage]);
  }

  useResetRows(): () => void {
    const setState = this.useSetState();

    return useCallback(() => {
      setState((prev) => ({ ...prev, rows: [] }));
    }, [setState]);
  }
}

export const hrcsSearchStore = new HrcsSearchStore(HrcsSearchStore.name, {
  tasks: hrcsTask.initValues,
  query: {
    pageNo: 1,
    inqryBgnDt: DateTime.local().toFormat(DateFormat),
    inqryEndDt: DateTime.local().toFormat(DateFormat),
  },
  rows: [],
});
