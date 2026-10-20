'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Layers,
  FlaskConical,
  CheckCircle2,
  GitCompare,
  History,
  LayoutDashboard,
  Menu,
  X,
  Shield,
  Building2,
  Sparkles,
} from 'lucide-react';
import { Logo } from './Logo';
import {
  getSessionRole,
  getSessionTenant,
  setSessionRole,
  setSessionTenant,
} from '../lib/api';
import { UserRole } from '../lib/types';

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/prompts', label: 'Prompts & Diffs', icon: Layers },
  { href: '/experiments', label: 'A/B Experiments', icon: FlaskConical },
  { href: '/evaluations', label: 'Offline Evals', icon: GitCompare },
  { href: '/releases', label: 'Release Gates', icon: CheckCircle2 },
  { href: '/audit', label: 'Audit Trail', icon: History },
];

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeRole, setActiveRole] = useState<UserRole>('approver');
  const [activeTenant, setActiveTenant] = useState<string>('tenant-enterprise-default');

  useEffect(() => {
    setActiveRole(getSessionRole());
    setActiveTenant(getSessionTenant());
  }, []);

  const handleRoleChange = (role: UserRole) => {
    setActiveRole(role);
    setSessionRole(role);
    // Reload to refresh permissions context
    window.location.reload();
  };

  const handleTenantChange = (tenant: string) => {
    setActiveTenant(tenant);
    setSessionTenant(tenant);
    window.location.reload();
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-surface-200/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <Link href="/" className="hover:opacity-90 transition flex items-center">
            <Logo size="sm" />
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Tenant & Role Switchers */}
          <div className="hidden md:flex items-center space-x-3">
            {/* Tenant Selector */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-100 border border-white/10 text-xs text-slate-300">
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              <select
                value={activeTenant}
                onChange={(e) => handleTenantChange(e.target.value)}
                className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
              >
                <option value="tenant-enterprise-default" className="bg-slate-900 text-white">
                  tenant-enterprise-default
                </option>
                <option value="tenant-fintech-prod" className="bg-slate-900 text-white">
                  tenant-fintech-prod
                </option>
                <option value="tenant-healthcare-ai" className="bg-slate-900 text-white">
                  tenant-healthcare-ai
                </option>
              </select>
            </div>

            {/* Operator Role Selector */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-100 border border-white/10 text-xs text-slate-300">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <select
                value={activeRole}
                onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                className="bg-transparent font-medium text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="approver" className="bg-slate-900 text-white">
                  Approver (Full Release Control)
                </option>
                <option value="editor" className="bg-slate-900 text-white">
                  Editor (Drafts & Evals)
                </option>
                <option value="viewer" className="bg-slate-900 text-white">
                  Viewer (Demo Mode Read-Only)
                </option>
              </select>
            </div>

            {/* Live Telemetry Status Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Production Ready</span>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex lg:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 focus:outline-none"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-white/10 bg-surface-200 px-4 pt-3 pb-6 space-y-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Mobile Tenant & Role Selection */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Active Tenant / Workspace
              </label>
              <select
                value={activeTenant}
                onChange={(e) => handleTenantChange(e.target.value)}
                className="w-full bg-surface-100 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              >
                <option value="tenant-enterprise-default">tenant-enterprise-default</option>
                <option value="tenant-fintech-prod">tenant-fintech-prod</option>
                <option value="tenant-healthcare-ai">tenant-healthcare-ai</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Operator Role Context
              </label>
              <select
                value={activeRole}
                onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                className="w-full bg-surface-100 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              >
                <option value="approver">Approver (Full Release Control)</option>
                <option value="editor">Editor (Drafts & Evals)</option>
                <option value="viewer">Viewer (Demo Mode Read-Only)</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
