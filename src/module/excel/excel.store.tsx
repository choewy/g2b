import { RecoilStore } from '@core/recoil-store';

import { ExcelDto } from './dto/excel.dto';
import { Link, TableCellProps } from '@mui/material';
import { SearchType } from '@module/search/dto/enums';
import { appConfig } from '@config/app.config';
import { DateTime } from 'luxon';

export type ExcelStoreProps = {
  query: { type: SearchType };
  rows: ExcelDto[];
};

export class ExcelStore extends RecoilStore<ExcelStoreProps> {
  useTableColumns(): TableCellProps[] {
    return [
      {
        children: '순번',
        sx: { minWidth: 40 },
        align: 'center',
      },
      {
        children: '수집완료일시',
        sx: { minWidth: 100, width: '100%' },
        align: 'center',
      },
    ];
  }

  useTableRows(): TableCellProps[][] {
    const value = this.useValue();
    const rows: TableCellProps[][] = [];

    for (let i = 0; i < value.rows.length; i++) {
      const file = value.rows[i];
      const row: TableCellProps[] = [
        {
          children: i + 1,
          align: 'center',
        },
        {
          children: (
            <Link href={[appConfig.getCDNUrl(), file.key].join('/')}>
              {DateTime.fromJSDate(new Date(file.uploadedAt)).toFormat('yyyy-MM-dd HH:mm:ss')}
            </Link>
          ),
          align: 'center',
        },
      ];

      rows.push(row);
    }

    return rows;
  }
}

export const excelStore = new ExcelStore({
  query: { type: SearchType.Bids },
  rows: [],
});
