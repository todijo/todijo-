"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type TrendPoint = { label: string; revenue: number; orders: number };
type RankedProduct = { name: string; quantity: number };
type StatusPoint = { label: string; value: number };

export default function SellerAnalytics({ trends, products, statuses, currency, labels }: { trends: TrendPoint[]; products: RankedProduct[]; statuses: StatusPoint[]; currency: string; labels: { revenue: string; orders: string; topProducts: string; statuses: string } }) {
  const colors = ["#0b9368", "#4d8fc4", "#d59a35", "#835db4", "#c45a5a", "#67ad91", "#71817b"];
  const currencyText = (value: number) => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
  return <div className="sellerAnalyticsGrid">
    <section className="sellerChartCard" role="img" aria-label={labels.revenue}><h3>{labels.revenue}</h3><ResponsiveContainer width="100%" height={230}><AreaChart data={trends}><defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0b9368" stopOpacity={.32}/><stop offset="95%" stopColor="#0b9368" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="var(--dash-border)" vertical={false}/><XAxis dataKey="label" tick={{ fill: "var(--dash-muted)", fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis tick={{ fill: "var(--dash-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={38}/><Tooltip formatter={(value) => currencyText(Number(value))}/><Area type="monotone" dataKey="revenue" stroke="#0b9368" strokeWidth={2.5} fill="url(#revenueFill)"/></AreaChart></ResponsiveContainer></section>
    <section className="sellerChartCard" role="img" aria-label={labels.orders}><h3>{labels.orders}</h3><ResponsiveContainer width="100%" height={230}><BarChart data={trends}><CartesianGrid stroke="var(--dash-border)" vertical={false}/><XAxis dataKey="label" tick={{ fill: "var(--dash-muted)", fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{ fill: "var(--dash-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={28}/><Tooltip/><Bar dataKey="orders" fill="#4d8fc4" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></section>
    <section className="sellerChartCard" role="img" aria-label={labels.topProducts}><h3>{labels.topProducts}</h3><ResponsiveContainer width="100%" height={230}><BarChart data={products} layout="vertical" margin={{ left: 10 }}><CartesianGrid stroke="var(--dash-border)" horizontal={false}/><XAxis type="number" allowDecimals={false} hide/><YAxis dataKey="name" type="category" width={105} tick={{ fill: "var(--dash-muted)", fontSize: 11 }} axisLine={false} tickLine={false}/><Tooltip/><Bar dataKey="quantity" fill="#0b9368" radius={[0,6,6,0]}/></BarChart></ResponsiveContainer></section>
    <section className="sellerChartCard sellerStatusChart" role="img" aria-label={labels.statuses}><h3>{labels.statuses}</h3><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={statuses} dataKey="value" nameKey="label" innerRadius={48} outerRadius={76} paddingAngle={3}>{statuses.map((item, index) => <Cell key={item.label} fill={colors[index % colors.length]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer><div className="sellerChartLegend">{statuses.map((item, index) => <span key={item.label}><i style={{ background: colors[index % colors.length] }}/>{item.label} <strong>{item.value}</strong></span>)}</div></section>
  </div>;
}
