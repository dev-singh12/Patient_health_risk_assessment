import { useState } from "react";

export function usePagination(initialLimit = 10) {
  const [page, setPage] = useState(1);
  const [limit] = useState(initialLimit);

  function nextPage(hasNext) {
    if (hasNext) setPage((p) => p + 1);
  }

  function prevPage(hasPrev) {
    if (hasPrev) setPage((p) => p - 1);
  }

  function reset() {
    setPage(1);
  }

  return { page, limit, nextPage, prevPage, reset };
}
