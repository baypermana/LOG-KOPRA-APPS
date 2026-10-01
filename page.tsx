'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { generateTag } from '@/lib/supabase/helpers'

export default function Home(){
  const [tab, setTab] = useState('dashboard')
  const [company, setCompany] = useState<any>({nama:'Loading...', alamat:'...', npwp:'', telp:''})
  const [vendors, setVendors] = useState<string[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState('Syncing...')
  const [form, setForm] = useState({vendor:'', jenis:'Meranti', grade:'A', panjang:4.2, dPangkal:48, dUjung:42, yard:'Yard A1'})
  const [companyForm, setCompanyForm] = useState({nama:'', alamat:'', npwp:'', telp:''})
  const [newVendor, setNewVendor] = useState('')

  // Load all from Supabase
  const loadAll = async () => {
    setLoading(true)
    setSyncStatus('Syncing ke oiuohovbkpideyuqutvb...')
    try {
      const { data: comp } = await supabase.from('company_profile').select('*').limit(1).single()
      if(comp){ setCompany(comp); setCompanyForm(comp) }
      const { data: vend } = await supabase.from('master_vendors').select('*').eq('kategori','LOG').order('nama')
      if(vend) setVendors(vend.map((v:any)=>v.nama))
      const { data: kayu } = await supabase.from('kayu_logs').select('*').order('created_at',{ascending:false}).limit(20)
      if(kayu) setLogs(kayu)
      const { data: aging } = await supabase.from('v_kayu_logs_aging').select('*').order('tgl_masuk',{ascending:false}).limit(20)
      if(aging) setLogs(aging) // pakai view yang ada aging_hitung
      setSyncStatus('✅ Synced: '+ new Date().toLocaleTimeString('id-ID'))
    } catch(e:any){ setSyncStatus('❌ Error: '+e.message) }
    setLoading(false)
  }

  useEffect(()=>{ loadAll() },[])

  // Realtime
  useEffect(()=>{
    const ch = supabase.channel('kayu_logs_sync').on('postgres_changes',{event:'*', schema:'public', table:'kayu_logs'}, ()=>loadAll()).subscribe()
    return ()=>{ supabase.removeChannel(ch) }
  },[])

  const saveCompany = async () => {
    const { error } = await supabase.from('company_profile').update({nama:companyForm.nama, alamat:companyForm.alamat, npwp:companyForm.npwp, telp:companyForm.telp}).eq('id', company.id)
    if(!error){ setCompany(companyForm); alert('Profil perusahaan tersimpan ke Supabase!') } else alert(error.message)
  }

  const addVendor = async () => {
    if(!newVendor) return
    const { error } = await supabase.from('master_vendors').insert({kategori:'LOG', nama:newVendor})
    if(!error){ setVendors([...vendors, newVendor]); setNewVendor(''); setForm({...form, vendor:newVendor}) } else alert(error.message)
  }

  const saveLog = async () => {
    const id = `LOG-${Date.now().toString().slice(-4)}`
    const tag = generateTag()
    const { error } = await supabase.from('kayu_logs').insert({
      id, tag_id: tag, vendor: form.vendor || vendors[0], jenis: form.jenis, grade: form.grade,
      panjang_m: form.panjang, d_pangkal_cm: form.dPangkal, d_ujung_cm: form.dUjung, yard: form.yard
    })
    if(!error){ alert('Log tersimpan! Volume auto hitung di DB'); loadAll() } else alert(error.message)
  }

  const volPreview = useMemo(()=>{
    const dRata = (form.dPangkal + form.dUjung)/2/100
    return 0.785398163 * dRata * dRata * form.panjang
  },[form])

  return (
    <div className="min-h-screen pb-24 max-w-6xl mx-auto bg-[#f8faf6]">
      <header className="bg-[#0a0f0a] text-white p-4 sticky top-0 z-30 flex justify-between">
        <div><p className="font-black text-sm">{company.nama}</p><p className="text-[10px] opacity-60 truncate w-[200px]">{company.alamat}</p><p className="text-[9px] mt-1 bg-emerald-500 inline-block px-2 py-0.5 rounded-full">{syncStatus}</p></div>
        <div className="text-[9px] opacity-50 text-right">oiuohov...<br/>supabase.co<br/>✅ Connected</div>
      </header>

      {tab==='dashboard' && (
        <div className="p-4 space-y-4">
          <h1 className="font-bold">Dashboard - Synced</h1>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-2xl border"><p className="text-[11px]">Total Log</p><p className="font-bold text-xl">{logs.length}</p></div>
            <div className="bg-black text-white p-4 rounded-2xl"><p className="text-[11px] opacity-60">Aging {'>'}30d</p><p className="font-bold text-xl">{logs.filter((l:any)=>l.aging_hitung>30).length} perlu gesek</p></div>
          </div>
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="p-3 font-bold text-sm flex justify-between"><span>Stok Terbaru (dari Supabase)</span><button onClick={loadAll} className="text-xs border px-2 py-1 rounded-full">Refresh</button></div>
            <table className="w-full text-xs"><thead className="bg-gray-50"><tr><th className="p-2">TAG</th><th>Vendor</th><th>Vol</th><th>Aging</th></tr></thead>
            <tbody>{logs.map((l:any)=><tr key={l.tag_id} className="border-t"><td className="p-2 font-mono">{l.tag_id}</td><td className="p-2">{l.vendor}</td><td className="p-2">{Number(l.volume_m3||0).toFixed(3)}</td><td className={`p-2 ${l.aging_hitung>30?'text-red-600 font-bold':'text-emerald-600'}`}>{l.aging_hitung}d</td></tr>)}</tbody></table>
          </div>
        </div>
      )}

      {tab==='inbound' && (
        <div className="p-4 space-y-4">
          <div className="bg-white p-4 rounded-[20px] border space-y-3">
            <p className="font-bold text-sm">Input Kayu Log - Langsung ke Supabase</p>
            <div>
              <label className="text-[11px]">Vendor (bisa tambah baru)</label>
              <div className="flex gap-2 mt-1">
                <select value={form.vendor} onChange={e=>setForm({...form, vendor:e.target.value})} className="flex-1 border rounded-xl p-3 text-sm">
                  {vendors.map(v=><option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="flex gap-2 mt-2">
                <input value={newVendor} onChange={e=>setNewVendor(e.target.value)} placeholder="Ketik vendor baru" className="flex-1 border rounded-xl p-2 text-sm"/>
                <button onClick={addVendor} className="bg-black text-white px-3 rounded-xl text-xs">+ Tambah</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input value={form.jenis} onChange={e=>setForm({...form, jenis:e.target.value})} className="border rounded-xl p-3 text-sm" placeholder="Jenis Kayu (ketik manual)"/>
              <select value={form.grade} onChange={e=>setForm({...form, grade:e.target.value})} className="border rounded-xl p-3 text-sm"><option>A</option><option>B</option><option>C</option></select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" value={form.panjang} onChange={e=>setForm({...form, panjang:+e.target.value})} className="border rounded-xl p-3 text-sm" placeholder="Panjang m"/>
              <input type="number" value={form.dPangkal} onChange={e=>setForm({...form, dPangkal:+e.target.value})} className="border rounded-xl p-3 text-sm" placeholder="D Pangkal"/>
              <input type="number" value={form.dUjung} onChange={e=>setForm({...form, dUjung:+e.target.value})} className="border rounded-xl p-3 text-sm" placeholder="D Ujung"/>
            </div>
            <div className="bg-black text-white p-4 rounded-xl flex justify-between"><div><p className="text-[10px] opacity-60">VOLUME PREVIEW</p><p className="text-xl font-bold">{volPreview.toFixed(4)} m³</p><p className="text-[10px] opacity-60">Final akan auto hitung di DB</p></div><div className="text-right"><p className="text-[10px] opacity-60">TAG Auto</p><p className="text-xs font-mono">{generateTag()}</p></div></div>
            <button onClick={saveLog} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold">Simpan ke Supabase</button>
          </div>
        </div>
      )}

      {tab==='settings' && (
        <div className="p-4 space-y-4">
          <div className="bg-white p-5 rounded-[20px] border">
            <h2 className="font-bold mb-3">Profil Perusahaan - Edit & Sync</h2>
            <div className="grid gap-3">
              <input value={companyForm.nama} onChange={e=>setCompanyForm({...companyForm, nama:e.target.value})} className="border rounded-xl p-3 text-sm" placeholder="Nama Perusahaan"/>
              <textarea value={companyForm.alamat} onChange={e=>setCompanyForm({...companyForm, alamat:e.target.value})} className="border rounded-xl p-3 text-sm" rows={2} placeholder="Alamat"/>
              <div className="grid grid-cols-2 gap-3"><input value={companyForm.npwp||''} onChange={e=>setCompanyForm({...companyForm, npwp:e.target.value})} className="border rounded-xl p-3 text-sm" placeholder="NPWP"/><input value={companyForm.telp||''} onChange={e=>setCompanyForm({...companyForm, telp:e.target.value})} className="border rounded-xl p-3 text-sm" placeholder="Telp"/></div>
            </div>
            <button onClick={saveCompany} className="mt-4 w-full bg-black text-white py-3 rounded-xl font-bold">Simpan ke Supabase</button>
          </div>
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs"><p className="font-bold">⚠️ Keamanan</p><p>SECRET KEY yang kamu share di chat tolong di-rotate di Dashboard > Settings > API Keys > Reset. PWA hanya butuh PUBLISHABLE KEY.</p></div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around p-2 max-w-6xl mx-auto">
        {[{id:'dashboard',label:'Dashboard'},{id:'inbound',label:'Inbound'},{id:'settings',label:'Settings'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} className={`px-6 py-2 rounded-xl text-xs ${tab===t.id?'bg-black text-white':'opacity-60'}`}>{t.label}</button>
        ))}
      </div>
    </div>
  )
}
