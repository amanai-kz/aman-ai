"use client"

import { useSyncExternalStore } from "react"

const emptySubscribe = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

export function useIsHydrated() {
  return useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot)
}
