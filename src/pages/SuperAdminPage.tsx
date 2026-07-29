import { useEffect, useState } from "react";
import { MdPeople, MdBusiness, MdBlock, MdCheckCircle, MdDelete, MdRefresh, MdSearch, MdLogout, MdBarChart } from "react-icons/md";
import { logOut } from "../services/firebase";
import { clearCurrentUser } from "../features/auth/authSlice";
import { clearCompany }     from "../features/company/companySlice";
import { useDispatch }      from "react-redux";
import { PlatformAdminService } from "../services/platform-admin.service";
import { SubscriptionService }  from "../services/subscription.service";
import { useNavigate } from "react-router-dom";
import { UserProfile, Company, SubscriptionPlan, PLANS } from "../types";
import Logo from "../assets/img/stocktrack-logo.png";

const planStyle: Record<SubscriptionPlan,{bg:string;text:string;label:string}> = {
  starter:      {bg:"var(--color-surface-3)",     text:"var(--color-text-muted)",         label:"Starter"},
  most_popular: {bg:"var(--color-nav-active-bg)", text:"var(--color-brand-primary-soft)",  label:"Pro"},
  enterprise:   {bg:"var(--color-warning-soft)",  text:"var(--color-warning)",             label:"Enterprise"},
};
const PlanBadge = ({plan}:{plan:SubscriptionPlan})=>{
  const s=planStyle[plan]??planStyle.starter;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{background:s.bg,color:s.text}}>{s.label}</span>;
};
const statusStyle=(s:string)=>s==="active"
  ?{bg:"var(--color-stock-in-soft)",text:"var(--color-stock-in)"}
  :{bg:"var(--color-danger-soft)",  text:"var(--color-danger)"};

type Tab = "users"|"companies"|"subscriptions"|"stats";

const SuperAdminPage = () => {
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const [tab,       setTab]       = useState<Tab>("users");
  const [users,     setUsers]     = useState<UserProfile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search,    setSearch]    = useState("");
  const [loading,   setLoading]   = useState(true);
  const [stats,     setStats]     = useState({ totalUsers:0, totalCompanies:0, activePlans:{} as Record<string,number> });

  const load = async () => {
    setLoading(true);
    try {
      const [u, c, s] = await Promise.all([
        PlatformAdminService.listAllUsers(),
        PlatformAdminService.listAllCompanies(),
        PlatformAdminService.getStats(),
      ]);
      setUsers(u); setCompanies(c); setStats(s);
    } finally { setLoading(false); }
  };
  useEffect(()=>{ load(); },[]);

  const toggleUser = async (uid: string, cur: string) => {
    await PlatformAdminService.toggleUserStatus(uid, cur);
    setUsers((p) => p.map((u) => u.uid === uid ? { ...u, status: cur === "active" ? "inactive" : "active" } : u));
  };
  const deleteUser = async (uid: string) => { if (!confirm("Delete user permanently?")) return; await PlatformAdminService.deleteUser(uid); setUsers((p) => p.filter((u) => u.uid !== uid)); };
  const toggleCompany = async (id: string, cur: string) => {
    await PlatformAdminService.toggleCompanyStatus(id, cur);
    setCompanies((p) => p.map((c) => c.id === id ? { ...c, status: cur === "active" ? "inactive" : "active" } : c));
  };
  const deleteCompany = async(id:string)=>{ if(!confirm("Delete company?")) return; await PlatformAdminService.deleteCompany(id); setCompanies(p=>p.filter(c=>c.id!==id)); };
  const changePlan    = async(companyId:string,plan:SubscriptionPlan)=>{ await SubscriptionService.upgrade(companyId,plan); await load(); };

  const fu = users.filter(u=>u.email?.toLowerCase().includes(search.toLowerCase())||u.displayName?.toLowerCase().includes(search.toLowerCase()));
  const fc = companies.filter(c=>c.name?.toLowerCase().includes(search.toLowerCase())||c.email?.toLowerCase().includes(search.toLowerCase()));

  const STAT_CARDS = [
    {label:"Total Users",     value:stats.totalUsers,                     color:"var(--color-brand-primary-soft)"},
    {label:"Active Users",    value:users.filter(u=>u.status==="active").length, color:"var(--color-success)"},
    {label:"Total Companies", value:stats.totalCompanies,                 color:"var(--color-info)"},
    {label:"Starter Plans",   value:stats.activePlans?.starter??0,        color:"var(--color-text-muted)"},
    {label:"Pro Plans",       value:stats.activePlans?.most_popular??0,   color:"var(--color-brand-primary-soft)"},
    {label:"Enterprise",      value:stats.activePlans?.enterprise??0,     color:"var(--color-warning)"},
  ];

  const TABS:{id:Tab;icon:React.ReactNode;label:string}[] = [
    {id:"users",         icon:<MdPeople size={15}/>,   label:"Users"},
    {id:"companies",     icon:<MdBusiness size={15}/>, label:"Companies"},
    {id:"subscriptions", icon:<MdCheckCircle size={15}/>,label:"Subscriptions"},
    {id:"stats",         icon:<MdBarChart size={15}/>, label:"Usage Stats"},
  ];

  return (
    <div className="min-h-screen" style={{background:"var(--color-bg-app)"}}>
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 h-14" style={{background:"var(--color-bg-header)",borderBottom:"1px solid var(--color-border-subtle)"}}>
        <div className="flex items-center gap-3">
          <img src={Logo} alt="ProInventory" className="w-7 h-7 rounded-lg"/>
          <span className="text-sm font-bold" style={{color:"var(--color-text-primary)"}}>Super<span style={{color:"var(--color-brand-primary-soft)"}}>Admin</span></span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{background:"var(--color-danger-soft)",color:"var(--color-danger)"}}>Platform Admin</span>
        </div>
        <div className="flex gap-3">
          <button onClick={load} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{background:"var(--color-surface-3)",color:"var(--color-text-muted)",border:"1px solid var(--color-border-soft)"}}><MdRefresh size={14}/> Refresh</button>
          <button onClick={async()=>{ await logOut(); dispatch(clearCurrentUser()); dispatch(clearCompany()); sessionStorage.removeItem("currentUser"); navigate("/login"); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{background:"var(--color-danger-soft)",color:"var(--color-danger)",border:"1px solid var(--color-danger-border)"}}><MdLogout size={14}/> Sign Out</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {STAT_CARDS.map(({label,value,color})=>(
            <div key={label} className="rounded-xl p-4" style={{background:"var(--color-surface-1)",border:"1px solid var(--color-border-soft)"}}>
              <p className="text-2xl font-extrabold" style={{color}}>{value}</p>
              <p className="text-xs mt-0.5" style={{color:"var(--color-text-muted)"}}>{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs + search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
          <div className="flex rounded-xl p-1 gap-1" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border-soft)"}}>
            {TABS.map(({id,icon,label})=>(
              <button key={id} onClick={()=>setTab(id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium capitalize" style={tab===id?{background:"var(--color-brand-primary)",color:"white"}:{color:"var(--color-text-muted)"}}>
                {icon}{label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl w-full sm:w-64" style={{background:"var(--color-input-bg)",border:"1px solid var(--color-input-border)"}}>
            <MdSearch size={15} style={{color:"var(--color-input-icon)"}}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" className="flex-1 bg-transparent outline-none text-xs" style={{color:"var(--color-input-text)"}}/>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{borderColor:"var(--color-brand-primary)"}}/></div>
        ) : (
          <>
            {/* ══ USERS ══ */}
            {tab==="users" && (
              <div className="rounded-2xl overflow-hidden" style={{background:"var(--color-surface-1)",border:"1px solid var(--color-border-soft)"}}>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr style={{borderBottom:"1px solid var(--color-border-subtle)"}}>
                      {["Name","Email","Role","Company","Plan","Status","Actions"].map(h=><th key={h} className="px-4 py-3 text-left font-semibold uppercase" style={{color:"var(--color-text-faint)"}}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {fu.length===0?<tr><td colSpan={7} className="text-center py-10" style={{color:"var(--color-text-faint)"}}>No users found.</td></tr>
                      :fu.map(u=>{ const ss=statusStyle(u.status); return (
                        <tr key={u.uid} style={{borderBottom:"1px solid var(--color-border-subtle)"}}
                          onMouseEnter={e=>(e.currentTarget.style.background="var(--color-surface-2)")}
                          onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                          <td className="px-4 py-3 font-medium" style={{color:"var(--color-text-primary)"}}>{u.displayName||"—"}</td>
                          <td className="px-4 py-3" style={{color:"var(--color-text-secondary)"}}>{u.email}</td>
                          <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize" style={{background:"var(--color-nav-active-bg)",color:"var(--color-brand-primary-soft)"}}>{u.role?.replace("_"," ")??"staff"}</span></td>
                          <td className="px-4 py-3 font-mono text-[10px]" style={{color:"var(--color-text-faint)"}}>{u.companyId?.slice(0,14)??"—"}</td>
                          <td className="px-4 py-3">{(()=>{const co=companies.find(c=>c.id===u.companyId);return co?<PlanBadge plan={co.plan}/>:<span style={{color:"var(--color-text-faint)"}}>—</span>;})()}</td>
                          <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize" style={{background:ss.bg,color:ss.text}}>{u.status}</span></td>
                          <td className="px-4 py-3"><div className="flex gap-2">
                            <button onClick={()=>toggleUser(u.uid,u.status)} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{background:"var(--color-surface-3)",color:u.status==="active"?"var(--color-warning)":"var(--color-success)"}}>{u.status==="active"?<MdBlock size={13}/>:<MdCheckCircle size={13}/>}</button>
                            <button onClick={()=>deleteUser(u.uid)} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{background:"var(--color-danger-soft)",color:"var(--color-danger)"}}><MdDelete size={13}/></button>
                          </div></td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ══ COMPANIES ══ */}
            {tab==="companies" && (
              <div className="rounded-2xl overflow-hidden" style={{background:"var(--color-surface-1)",border:"1px solid var(--color-border-soft)"}}>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr style={{borderBottom:"1px solid var(--color-border-subtle)"}}>
                      {["Company","Email","Owner","Plan","Industry","Status","Actions"].map(h=><th key={h} className="px-4 py-3 text-left font-semibold uppercase" style={{color:"var(--color-text-faint)"}}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {fc.length===0?<tr><td colSpan={7} className="text-center py-10" style={{color:"var(--color-text-faint)"}}>No companies found.</td></tr>
                      :fc.map(c=>{ const ss=statusStyle(c.status); return (
                        <tr key={c.id} style={{borderBottom:"1px solid var(--color-border-subtle)"}}
                          onMouseEnter={e=>(e.currentTarget.style.background="var(--color-surface-2)")}
                          onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                          <td className="px-4 py-3 font-semibold" style={{color:"var(--color-text-primary)"}}>{c.name}</td>
                          <td className="px-4 py-3" style={{color:"var(--color-text-secondary)"}}>{c.email}</td>
                          <td className="px-4 py-3 font-mono text-[10px]" style={{color:"var(--color-text-faint)"}}>{c.ownerId?.slice(0,10)}…</td>
                          <td className="px-4 py-3"><PlanBadge plan={c.plan}/></td>
                          <td className="px-4 py-3" style={{color:"var(--color-text-muted)"}}>{c.industry||"—"}</td>
                          <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize" style={{background:ss.bg,color:ss.text}}>{c.status}</span></td>
                          <td className="px-4 py-3"><div className="flex gap-2">
                            <button onClick={()=>toggleCompany(c.id,c.status)} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{background:"var(--color-surface-3)",color:c.status==="active"?"var(--color-warning)":"var(--color-success)"}}>{c.status==="active"?<MdBlock size={13}/>:<MdCheckCircle size={13}/>}</button>
                            <button onClick={()=>deleteCompany(c.id)} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{background:"var(--color-danger-soft)",color:"var(--color-danger)"}}><MdDelete size={13}/></button>
                          </div></td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ══ SUBSCRIPTIONS ══ */}
            {tab==="subscriptions" && (
              <div className="rounded-2xl overflow-hidden" style={{background:"var(--color-surface-1)",border:"1px solid var(--color-border-soft)"}}>
                <table className="w-full text-xs">
                  <thead><tr style={{borderBottom:"1px solid var(--color-border-subtle)"}}>
                    {["Company","Current Plan","Change Plan"].map(h=><th key={h} className="px-4 py-3 text-left font-semibold uppercase" style={{color:"var(--color-text-faint)"}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {companies.map(c=>(
                      <tr key={c.id} style={{borderBottom:"1px solid var(--color-border-subtle)"}}
                        onMouseEnter={e=>(e.currentTarget.style.background="var(--color-surface-2)")}
                        onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                        <td className="px-4 py-3 font-semibold" style={{color:"var(--color-text-primary)"}}>{c.name}</td>
                        <td className="px-4 py-3"><PlanBadge plan={c.plan}/></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 flex-wrap">
                            {(["starter","most_popular","enterprise"] as SubscriptionPlan[]).map(p=>(
                              <button key={p} disabled={c.plan===p} onClick={()=>changePlan(c.id,p)}
                                className="px-2 py-1 rounded text-[10px] font-semibold disabled:opacity-40 capitalize"
                                style={{background:c.plan===p?"var(--color-stock-in-soft)":"var(--color-nav-active-bg)",color:c.plan===p?"var(--color-stock-in)":"var(--color-brand-primary-soft)",border:"1px solid var(--color-border-brand)"}}>
                                {p.replace("_"," ")}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ══ USAGE STATS ══ */}
            {tab==="stats" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    {label:"Total Users",       value:stats.totalUsers,                    color:"var(--color-brand-primary-soft)"},
                    {label:"Total Companies",   value:stats.totalCompanies,               color:"var(--color-info)"},
                    {label:"Active Companies",  value:companies.filter(c=>c.status==="active").length, color:"var(--color-success)"},
                  ].map(({label,value,color})=>(
                    <div key={label} className="rounded-xl p-6 text-center" style={{background:"var(--color-surface-1)",border:"1px solid var(--color-border-soft)"}}>
                      <p className="text-4xl font-extrabold mb-1" style={{color}}>{value}</p>
                      <p className="text-sm" style={{color:"var(--color-text-muted)"}}>{label}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl p-6" style={{background:"var(--color-surface-1)",border:"1px solid var(--color-border-soft)"}}>
                  <h3 className="text-sm font-semibold mb-4 uppercase tracking-wide" style={{color:"var(--color-text-muted)"}}>Plan Distribution</h3>
                  <div className="space-y-3">
                    {PLANS.map(plan=>{
                      const count=companies.filter(c=>c.plan===plan.id).length;
                      const pct=stats.totalCompanies>0?Math.round((count/stats.totalCompanies)*100):0;
                      return (
                        <div key={plan.id}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span style={{color:"var(--color-text-secondary)"}}>{plan.name}</span>
                            <span style={{color:"var(--color-text-muted)"}}>{count} companies ({pct}%)</span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{background:"var(--color-surface-3)"}}>
                            <div className="h-full rounded-full transition-all" style={{width:`${pct}%`,background:"var(--color-brand-primary)"}}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl p-6" style={{background:"var(--color-surface-1)",border:"1px solid var(--color-border-soft)"}}>
                  <h3 className="text-sm font-semibold mb-4 uppercase tracking-wide" style={{color:"var(--color-text-muted)"}}>User Roles</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {(["super_admin","company_owner","company_admin","staff"] as const).map(role=>{
                      const count=users.filter(u=>u.role===role).length;
                      return (
                        <div key={role} className="rounded-xl p-4 text-center" style={{background:"var(--color-surface-3)"}}>
                          <p className="text-2xl font-extrabold" style={{color:"var(--color-brand-primary-soft)"}}>{count}</p>
                          <p className="text-xs mt-0.5 capitalize" style={{color:"var(--color-text-muted)"}}>{role.replace(/_/g," ")}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SuperAdminPage;
