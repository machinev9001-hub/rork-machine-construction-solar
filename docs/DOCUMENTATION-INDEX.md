# Documentation Index

## Overview
This directory contains comprehensive documentation for the project tracker application. All documentation has been consolidated and organized for easy navigation.

---

## 📚 Core Documentation

### [FIREBASE-INDEXES.md](./FIREBASE-INDEXES.md)
Complete guide to all required Firebase indexes including:
- Core workflow indexes (requests, activities, tasks)
- Multi-tenant & company indexes
- Plant asset allocation indexes
- Onboarding system indexes
- How to create and verify indexes

### [OFFLINE-SYSTEM.md](./OFFLINE-SYSTEM.md)
Comprehensive offline functionality guide covering:
- Storage strategy and capacity planning
- Priority system (P0-P3 sync)
- Data freshness management
- Offline authentication
- Queue management and monitoring

### [REQUEST-WORKFLOWS.md](./REQUEST-WORKFLOWS.md)
All request workflow implementations:
- Task requests
- Activity/scope requests
- QC requests
- Cabling, termination, handover requests
- Surveyor, concrete, commissioning workflows
- Lock systems and optimistic updates

### [AUTHENTICATION.md](./AUTHENTICATION.md)
Complete authentication system documentation:
- Employee login (ID Number + PIN)
- QR code authentication
- Master account login
- Session management and security
- Activation system
- Offline authentication

### [TESTING.md](./TESTING.md)
Testing setup and guidelines:
- Jest configuration
- Writing tests (unit, integration, performance)
- Running tests and coverage
- Comprehensive test checklist
- CI/CD integration

### [IMPLEMENTATION-GUIDE.md](./IMPLEMENTATION-GUIDE.md)
Implementation notes for specific features:
- Dashboard & BOQ system
- Progress tracking
- Plant asset management
- Onboarding system
- PV blocks
- Multi-tenant management
- Theme & UI
- Refactoring patterns
- Performance optimization

---

## 🗂️ Legacy Documentation (Archived)

The following files contain detailed historical context but have been consolidated into the main docs above:

### System Overview
- `SYSTEM-OVERVIEW.md` - System architecture overview
- `USER-MANUAL.md` - User guide
- `USER-ROLES.md` - Role definitions
- `API-REFERENCE.md` - API reference
- `SETUP-GUIDE.md` - Initial setup guide

### Database & Indexes
- `DATABASE-STRUCTURE.md` - Database schema
- `SUPERVISOR-DATABASE.md` - Supervisor-specific DB
- `PV-BLOCKS-DATABASE.md` - PV blocks schema
- `COMPANY-INDEXES.md` - Company index details
- `PLANT-ASSET-ALLOCATION-INDEXES.md` - Plant asset indexes
- `ONBOARDING-INDEXES.md` - Onboarding indexes
- `ACTIVATION-INDEXES.md` - Activation system indexes

### Authentication & Login
- `LOGIN-SYSTEM-IMPLEMENTATION.md` - Login system details
- `LOGIN-SYSTEM-CLARIFICATION.md` - Login clarifications
- `LOGIN-SYSTEM-ID-NUMBERS-ONLY.md` - ID number login
- `LOGIN-SYSTEM-PERSISTENCE-FIX.md` - Session persistence
- `SESSION-EXPIRY-IMPLEMENTATION.md` - Session expiry
- `MASTER-AUTHENTICATION-WORKFLOW.md` - Master auth flow
- `QR-AUTHENTICATION-SYSTEM.md` - QR code system
- `ACTIVATION-SYSTEM.md` - Activation code system

### Multi-Tenant
- `MULTI-TENANT-COMPANY-IMPLEMENTATION-STATUS.md` - Multi-tenant status
- `MISSING-INDEXES-2025.md` - Missing indexes (2025)
- `REQUIRED-INDEXES-COMPLETE.md` - Complete index list

### Plant & Assets
- `PLANT-ASSET-ALLOCATION-SYSTEM.md` - Allocation system
- `PLANT-ASSET-ALLOCATION-READY.md` - Ready status

### iOS Testing
- `IOS-TESTING-INSTRUCTIONS.md` - iOS testing guide

### Complete Workflow
- `COMPLETE-WORKFLOW-DOCUMENTATION.md` - Full workflow docs

---

## 🚀 Quick Start

### For New Developers
1. Read [SYSTEM-OVERVIEW.md](./SYSTEM-OVERVIEW.md) for architecture
2. Review [AUTHENTICATION.md](./AUTHENTICATION.md) for login flows
3. Check [FIREBASE-INDEXES.md](./FIREBASE-INDEXES.md) and create required indexes
4. Review [TESTING.md](./TESTING.md) and run tests

### For Feature Development
1. Check [REQUEST-WORKFLOWS.md](./REQUEST-WORKFLOWS.md) for workflow patterns
2. Review [IMPLEMENTATION-GUIDE.md](./IMPLEMENTATION-GUIDE.md) for specific features
3. Reference [OFFLINE-SYSTEM.md](./OFFLINE-SYSTEM.md) for offline support

### For Debugging
1. Check [TESTING.md](./TESTING.md) for test execution
2. Review [IMPLEMENTATION-GUIDE.md](./IMPLEMENTATION-GUIDE.md) debugging section
3. Check Firebase Console for index status

---

## 📋 File Organization

```
docs/
├── INDEX.md (this file)
├── FIREBASE-INDEXES.md          # All Firebase indexes
├── OFFLINE-SYSTEM.md            # Offline functionality
├── REQUEST-WORKFLOWS.md         # All request workflows
├── AUTHENTICATION.md            # Auth & login system
├── TESTING.md                   # Testing guide
├── IMPLEMENTATION-GUIDE.md      # Feature implementations
│
└── [Legacy files archived below]
    ├── SYSTEM-OVERVIEW.md
    ├── DATABASE-STRUCTURE.md
    ├── USER-ROLES.md
    └── ... (see Legacy Documentation section)
```

---

## 🔗 External Resources

- **Firebase Console**: https://console.firebase.google.com/
- **Expo Docs**: https://docs.expo.dev/
- **React Native**: https://reactnative.dev/
- **React Query**: https://tanstack.com/query/latest

---

## 📝 Contributing

When adding new features:
1. Update relevant consolidated docs
2. Add tests to [TESTING.md](./TESTING.md) checklist
3. Update [IMPLEMENTATION-GUIDE.md](./IMPLEMENTATION-GUIDE.md) if needed
4. Create Firebase indexes and document in [FIREBASE-INDEXES.md](./FIREBASE-INDEXES.md)

---

**Last Updated:** 2025-01-23  
**Documentation Version:** 2.0 (Consolidated)
