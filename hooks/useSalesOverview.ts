import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useSalesOverview() {
  return useSWR("/api/am/sales/overview", fetcher, {
    revalidateOnFocus: false,
  });
}
