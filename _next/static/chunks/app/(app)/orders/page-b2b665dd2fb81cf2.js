(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[425],{1907:(e,t,s)=>{"use strict";s.d(t,{d:()=>r,t:()=>i});var a=s(95155),l=s(12115);let n=(0,l.createContext)({notify:()=>{}}),r=()=>(0,l.useContext)(n);function i(e){let{children:t}=e,[s,r]=(0,l.useState)([]),i=(0,l.useCallback)(function(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"success",s=Date.now()+Math.random();r(a=>[...a,{id:s,kind:t,text:e}]),setTimeout(()=>r(e=>e.filter(e=>e.id!==s)),3500)},[]),c={success:"bg-green-600",error:"bg-rose-600",info:"bg-indigo-600"};return(0,a.jsxs)(n.Provider,{value:{notify:i},children:[t,(0,a.jsx)("div",{className:"fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[min(92vw,26rem)]",children:s.map(e=>(0,a.jsx)("div",{className:"".concat(c[e.kind]," text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-center animate-[fadeIn_.2s_ease-out]"),children:e.text},e.id))})]})}},7e3:(e,t,s)=>{"use strict";s.d(t,{IE:()=>d,b2:()=>r,h8:()=>o,m9:()=>n,nw:()=>i,tN:()=>l});let a=new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",minimumFractionDigits:0,maximumFractionDigits:2});function l(e){let t=Number(e||0);return"‏"+a.format(t)}function n(e){return e?new Date(e).toLocaleDateString("ar-EG",{timeZone:"Africa/Cairo",year:"numeric",month:"long",day:"numeric"}):"—"}function r(e){return e?new Date(e).toLocaleString("ar-EG",{timeZone:"Africa/Cairo",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):"—"}function i(e){return e?new Date(e).toLocaleTimeString("ar-EG",{timeZone:"Africa/Cairo",hour:"2-digit",minute:"2-digit"}):"—"}let c=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit"});function d(){let e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:new Date;return c.format(e)}function o(e){return d(new Date(Date.now()-864e5*e))}},25976:(e,t,s)=>{"use strict";s.d(t,{DO:()=>i,EA:()=>n,pp:()=>r,sc:()=>c});var a=s(95155);s(12115);var l=s(17268);function n(e){let{className:t=""}=e;return(0,a.jsx)("div",{className:"animate-pulse bg-slate-100 rounded-xl ".concat(t)})}function r(e){let{icon:t,title:s,hint:l}=e;return(0,a.jsxs)("div",{className:"text-center py-12 text-slate-400",children:[t&&(0,a.jsx)("div",{className:"flex justify-center mb-3 text-slate-300",children:t}),(0,a.jsx)("p",{className:"font-medium text-slate-500",children:s}),l&&(0,a.jsx)("p",{className:"text-sm mt-1",children:l})]})}function i(e){let{value:t,onChange:s,placeholder:n,className:r=""}=e;return(0,a.jsxs)("div",{className:"relative ".concat(r),children:[(0,a.jsx)("span",{className:"absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 pointer-events-none",children:(0,a.jsx)(l.C0,{className:"w-4 h-4"})}),(0,a.jsx)("input",{value:t,onChange:e=>s(e.target.value),placeholder:n,className:"pr-9"})]})}function c(e){let{options:t,value:s,onChange:l}=e;return(0,a.jsx)("div",{className:"flex flex-wrap gap-2",children:t.map(e=>(0,a.jsxs)("button",{onClick:()=>l(e.value),className:"text-sm px-3 py-1.5 rounded-full font-medium transition-colors ".concat(s===e.value?"bg-indigo-600 text-white":"bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"),children:[e.label,"number"==typeof e.count?" (".concat(e.count,")"):""]},e.value))})}},32081:(e,t,s)=>{Promise.resolve().then(s.bind(s,45157))},45157: (e, t, s) => {
            "use strict";
            s.r(t), s.d(t, {
                default: () => u
            });
            var a = s(95155),
                l = s(12115),
                n2 = s(95454),
                r = s(51365),
                i = s(7e3),
                c = s(67455),
                d = s(1907),
                o = s(25976);

            function u() {
                let [e, t] = (0, l.useState)([]),
                    [s, u] = (0, l.useState)(!0),
                    [m, x] = (0, l.useState)(""),
                    [p, f] = (0, l.useState)("all"),
                    [webOnly, setWebOnly] = (0, l.useState)(!1),
                    [b, g] = (0, l.useState)(null),
                    [couriers, setCouriers] = (0, l.useState)([]),
                    [confirmId, setConfirmId] = (0, l.useState)(null),
                    [confirmCourier, setConfirmCourier] = (0, l.useState)(""),
                    [confirmTracking, setConfirmTracking] = (0, l.useState)(""),
                    [confirmBusy, setConfirmBusy] = (0, l.useState)(!1),
                    { refreshBadges: h, profile: v } = (0, n2.n)(),
                    j = (0, r.U)(),
                    { notify: N } = (0, d.d)(),
                    y = (0, l.useCallback)(async () => {
                        u(!0), x("");
                        let { data: e, error: s } = await j.from("pos_orders")
                            .select("id, code, payment, status, total, created_at, source, governorate, address, shipping_fee, needs_production, customer_name, customer_phone")
                            .order("created_at", { ascending: !1 })
                            .limit(500);
                        if (s) { x(s.message), u(!1); return }
                        let a = e || [],
                            l2 = a.map(e => e.id),
                            n = [];
                        if (l2.length) {
                            let { data: e } = await j.from("pos_order_items")
                                .select("order_id, product_name, size, color, unit_price")
                                .in("order_id", l2);
                            n = e || []
                        }
                        let r2 = {};
                        n.forEach(e => { (r2[e.order_id] = r2[e.order_id] || []).push(e) }),
                            t(a.map(e => ({ ...e, pos_order_items: r2[e.id] || [] }))), u(!1)
                    }, []),
                    loadCouriers = (0, l.useCallback)(async () => {
                        let { data: e, error: t } = await j.rpc("pos_fn_couriers", {});
                        if (!t && (null == e ? void 0 : e.ok)) setCouriers(e.couriers || [])
                    }, []);

                async function _(e, t, s) {
                    g(e);
                    try {
                        var a;
                        let l3 = null != (a = null == v ? void 0 : v.id) ? a : null,
                            { error: n } = await j.rpc(t, { p_order: e, p_actor: l3 });
                        if (n) return void N(n.message, "error");
                        N(s), h(), await y()
                    } finally { g(null) }
                }

                function openConfirm(e) {
                    setConfirmId(e), setConfirmCourier(couriers[0] ? couriers[0].id : ""), setConfirmTracking("")
                }

                function closeConfirm() { setConfirmId(null), setConfirmTracking("") }

                async function submitConfirm(e) {
                    if (!confirmCourier) return void N("اختار مندوب الشحن الأول", "error");
                    setConfirmBusy(!0);
                    try {
                        var a;
                        let l4 = null != (a = null == v ? void 0 : v.id) ? a : null,
                            { data: t, error: s } = await j.rpc("shop_fn_confirm_web_order", {
                                p_order: e, p_courier: confirmCourier, p_actor: l4,
                                p_tracking: confirmTracking || null
                            });
                        if (s) return void N(s.message, "error");
                        N("تم تأكيد الطلب وإنشاء الشحنة"), closeConfirm(), h(), await y()
                    } finally { setConfirmBusy(!1) }
                }

                (0, l.useEffect)(() => { y(), loadCouriers() }, [y, loadCouriers]),
                (0, l.useEffect)(() => {
                    let e = () => { "visible" === document.visibilityState && y() };
                    return document.addEventListener("visibilitychange", e), () => document.removeEventListener("visibilitychange", e)
                }, [y]);

                let baseFiltered = (0, l.useMemo)(() => "all" === p ? e : e.filter(e => e.status === p), [e, p]),
                    w = (0, l.useMemo)(() => webOnly ? baseFiltered.filter(e => "web" === e.source) : baseFiltered, [baseFiltered, webOnly]),
                    C = t => e.filter(e => e.status === t).length,
                    webCount = e.filter(e => "web" === e.source && "fulfilled" !== e.status && "cancelled" !== e.status).length;

                return (0, a.jsxs)("div", {
                    className: "p-4 lg:p-6 space-y-4",
                    children: [
                        m && (0, a.jsxs)("div", {
                            className: "card border border-rose-200 bg-rose-50 text-rose-700 text-sm flex items-center justify-between gap-3",
                            children: [(0, a.jsxs)("span", { children: ["تعذّر تحميل الطلبات: ", m] }),
                            (0, a.jsx)("button", { onClick: y, className: "btn-secondary text-sm px-3 shrink-0", children: "إعادة المحاولة" })]
                        }),
                        (0, a.jsxs)("div", {
                            className: "flex flex-wrap items-center justify-between gap-3",
                            children: [
                                (0, a.jsx)(o.sc, {
                                    value: p, onChange: f,
                                    options: [
                                        { value: "all", label: "الكل", count: e.length },
                                        { value: "pending", label: "معلّق", count: C("pending") },
                                        { value: "reserved", label: "محجوز", count: C("reserved") },
                                        { value: "fulfilled", label: "منفّذ", count: C("fulfilled") },
                                        { value: "cancelled", label: "ملغى", count: C("cancelled") }
                                    ]
                                }),
                                (0, a.jsxs)("button", {
                                    onClick: () => setWebOnly(!webOnly),
                                    className: "text-sm px-3 py-1.5 rounded-full font-medium transition-colors " + (webOnly ? "bg-teal-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"),
                                    children: ["\ud83c\udf10 طلبات الويب", webCount > 0 ? " (" + webCount + ")" : ""]
                                })
                            ]
                        }),
                        (0, a.jsx)("div", {
                            className: "space-y-3",
                            children: s ? (0, a.jsx)(o.EA, { className: "h-40" })
                                : 0 === w.length ? (0, a.jsx)("div", { className: "card", children: (0, a.jsx)(o.pp, { title: "لا توجد طلبات" }) })
                                : w.map(e => {
                                    var t, s2, l5;
                                    let isWeb = "web" === e.source,
                                        openable = "pending" === e.status || "reserved" === e.status;
                                    return (0, a.jsxs)("div", {
                                        className: "card" + (isWeb ? " border-teal-200" : ""),
                                        children: [
                                            (0, a.jsxs)("div", {
                                                className: "flex flex-wrap items-start justify-between gap-4",
                                                children: [
                                                    (0, a.jsxs)("div", {
                                                        className: "flex-1 min-w-0",
                                                        children: [
                                                            (0, a.jsxs)("div", {
                                                                className: "flex items-center gap-3 mb-1 flex-wrap",
                                                                children: [
                                                                    (0, a.jsxs)("span", { className: "font-bold text-slate-900", children: ["#", e.code] }),
                                                                    (0, a.jsx)("span", {
                                                                        className: "badge " + ((null == (t = c.w8[e.status]) ? void 0 : t.color) || "bg-slate-100 text-slate-600"),
                                                                        children: (null == (s2 = c.w8[e.status]) ? void 0 : s2.label) || e.status
                                                                    }),
                                                                    isWeb && (0, a.jsx)("span", { className: "badge bg-teal-100 text-teal-700", children: "\ud83c\udf10 ويب" }),
                                                                    isWeb && e.needs_production && (0, a.jsx)("span", { className: "badge bg-amber-100 text-amber-700", children: "بانتظار توريد" }),
                                                                    (0, a.jsx)("span", { className: "text-xs text-slate-400", children: c.tK[e.payment] || e.payment })
                                                                ]
                                                            }),
                                                            isWeb && (0, a.jsxs)("p", {
                                                                className: "text-xs text-slate-500 mt-0.5",
                                                                children: [e.customer_name || "بدون اسم", e.customer_phone ? " \xb7 " + e.customer_phone : "", e.governorate ? " \xb7 " + e.governorate : "", e.address ? " \xb7 " + e.address : ""]
                                                            }),
                                                            (0, a.jsx)("div", {
                                                                className: "mt-2 space-y-1",
                                                                children: null == (l5 = e.pos_order_items) ? void 0 : l5.map((e, t) => (0, a.jsxs)("p", {
                                                                    className: "text-xs text-slate-500",
                                                                    children: [e.product_name, " — مقاس ", e.size, " (", e.color, ") \xb7 ", (0, i.tN)(e.unit_price)]
                                                                }, t))
                                                            })
                                                        ]
                                                    }),
                                                    (0, a.jsxs)("div", {
                                                        className: "text-left flex flex-col items-end gap-2",
                                                        children: [
                                                            (0, a.jsx)("p", { className: "font-bold text-lg text-indigo-600", children: (0, i.tN)(e.total) }),
                                                            isWeb && e.shipping_fee ? (0, a.jsxs)("p", { className: "text-xs text-slate-400", children: ["شحن ", (0, i.tN)(e.shipping_fee)] }) : null,
                                                            (0, a.jsx)("p", { className: "text-xs text-slate-400", children: (0, i.m9)(e.created_at) }),
                                                            (0, a.jsxs)("div", {
                                                                className: "flex gap-2 mt-1 flex-wrap justify-end",
                                                                children: [
                                                                    isWeb && openable && (0, a.jsx)("button", {
                                                                        disabled: confirmBusy && confirmId === e.id,
                                                                        onClick: () => openConfirm(e.id),
                                                                        className: "text-xs bg-teal-50 text-teal-700 px-3 py-1.5 rounded-lg hover:bg-teal-100 disabled:opacity-50",
                                                                        children: "تأكيد وشحن"
                                                                    }),
                                                                    !isWeb && "pending" === e.status && (0, a.jsx)("button", {
                                                                        disabled: b === e.id,
                                                                        onClick: () => _(e.id, "pos_fn_reserve_order", "تم حجز الطلب"),
                                                                        className: "text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100 disabled:opacity-50",
                                                                        children: "حجز المخزون"
                                                                    }),
                                                                    !isWeb && "reserved" === e.status && (0, a.jsx)("button", {
                                                                        disabled: b === e.id,
                                                                        onClick: () => _(e.id, "pos_fn_finalize_order", "تم تنفيذ الطلب"),
                                                                        className: "text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100 disabled:opacity-50",
                                                                        children: "تنفيذ الطلب"
                                                                    }),
                                                                    openable && (0, a.jsx)("button", {
                                                                        disabled: b === e.id,
                                                                        onClick: () => _(e.id, "pos_fn_cancel_order", "تم إلغاء الطلب"),
                                                                        className: "text-xs bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg hover:bg-rose-100 disabled:opacity-50",
                                                                        children: "إلغاء"
                                                                    })
                                                                ]
                                                            })
                                                        ]
                                                    })
                                                ]
                                            }),
                                            confirmId === e.id && (0, a.jsxs)("div", {
                                                className: "mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2",
                                                children: [
                                                    (0, a.jsx)("select", {
                                                        value: confirmCourier,
                                                        onChange: e2 => setConfirmCourier(e2.target.value),
                                                        className: "text-sm border border-slate-200 rounded-lg px-2 py-1.5",
                                                        children: [
                                                            (0, a.jsx)("option", { value: "", children: "اختر مندوب الشحن" }, "empty"),
                                                            ...couriers.map(c2 => (0, a.jsx)("option", { value: c2.id, children: c2.name }, c2.id))
                                                        ]
                                                    }),
                                                    (0, a.jsx)("input", {
                                                        value: confirmTracking,
                                                        onChange: e2 => setConfirmTracking(e2.target.value),
                                                        placeholder: "رقم التتبع (اختياري)",
                                                        className: "text-sm border border-slate-200 rounded-lg px-2 py-1.5 flex-1 min-w-[10rem]"
                                                    }),
                                                    (0, a.jsx)("button", {
                                                        disabled: confirmBusy,
                                                        onClick: submitConfirm,
                                                        className: "text-xs bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 disabled:opacity-50",
                                                        children: confirmBusy ? "جارٍ..." : "تأكيد"
                                                    }),
                                                    (0, a.jsx)("button", {
                                                        onClick: closeConfirm,
                                                        className: "text-xs bg-slate-50 text-slate-500 px-3 py-1.5 rounded-lg hover:bg-slate-100",
                                                        children: "إلغاء"
                                                    })
                                                ]
                                            })
                                        ]
                                    }, e.id)
                                })
                        })
                    ]
                })
            }
        },67455:(e,t,s)=>{"use strict";s.d(t,{tK:()=>a,w8:()=>l}),s(51365);let a={cash:"نقدًا",card:"بطاقة",mixed:"مختلط",cod:"دفع عند الاستلام",prepaid:"مدفوع مقدمًا"},l={pending:{label:"معلّق",color:"bg-amber-100 text-amber-700"},reserved:{label:"محجوز",color:"bg-blue-100 text-blue-700"},fulfilled:{label:"تم التنفيذ",color:"bg-green-100 text-green-700"},cancelled:{label:"ملغى",color:"bg-rose-100 text-rose-700"}}}},e=>{e.O(0,[730,540,949,441,255,358],()=>e(e.s=32081)),_N_E=e.O()}]);