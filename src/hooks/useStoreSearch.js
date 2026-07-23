// ============================================================
// src/hooks/useStoreSearch.js
// بحث المحلات، فحص رمز QR، والمحلات المستخدَمة مؤخراً (localStorage).
// ============================================================
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'

const RECENT_KEY = 'nq_confirm_recent_stores'
const MAX_RECENT = 5

function getRecentStores() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}

function pushRecentStore(store) {
  try {
    const list = getRecentStores().filter((s) => s.id !== store.id)
    list.unshift({ id: store.id, name: store.name, address: store.address, qr_token: store.qr_token })
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)))
  } catch { /* localStorage قد يكون ممتلئ أو معطّل — لا داعي لمقاطعة الموظف بسبب هذا */ }
}

async function searchStoresByName(term) {
  if (!term.trim()) return []
  const { data, error } = await supabase
    .from('stores')
    .select('id,name,address,qr_token,lat,lng')
    .eq('active', true)
    .ilike('name', `%${term.trim()}%`)
    .order('name')
    .limit(15)
  if (error) throw error
  return data || []
}

export default function useStoreSearch({ search, showToast, isOnline, onStoreSelected }) {
  const [recent, setRecent] = useState(getRecentStores)

  // ✅ نفس مهلة الـ350ms الأصلية قبل البحث
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const query = useQuery({
    queryKey: ['stores-search', debouncedSearch.trim()],
    queryFn: () => searchStoresByName(debouncedSearch),
    enabled: !!debouncedSearch.trim(),
  })

  // خطأ البحث يُعرض كتوست (سلوك مطابق للنسخة الأصلية)
  useEffect(() => {
    if (query.isError) {
      console.error('❌ خطأ البحث عن المحلات:', query.error)
      showToast('❌ تعذّر البحث عن المحلات — تحقق من الاتصال', true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.isError])

  const results = debouncedSearch.trim() ? (query.data || []) : []
  const searching = query.isLoading && !!debouncedSearch.trim()

  const handleSelect = (store) => {
    pushRecentStore(store)
    setRecent(getRecentStores())
    onStoreSelected(store)
  }

  const handleScan = async (text) => {
    if (!isOnline) { showToast('📡 لا يوجد اتصال بالإنترنت', true); return }
    try {
      const { data, error } = await supabase.from('stores').select('id,name,address,qr_token,lat,lng').eq('qr_token', text).eq('active', true).maybeSingle()
      if (error) throw error
      if (!data) { showToast('❌ رمز QR غير معروف أو المحل غير نشط', true); return }
      handleSelect(data)
    } catch (e) {
      console.error('❌ خطأ فحص QR:', e)
      showToast('❌ تعذّر التحقق من الرمز', true)
    }
  }

  return { results, searching, recent, handleSelect, handleScan }
}
