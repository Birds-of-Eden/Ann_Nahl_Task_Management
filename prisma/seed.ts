// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/* =========================================
   1) ROLES
========================================= */
const ROLES = [
  { id: "admin", name: "admin", description: "Administrator" },
  { id: "manager", name: "manager", description: "Manager" },
  { id: "agent", name: "agent", description: "Agent" },
  { id: "qc", name: "qc", description: "Quality Control" },
  { id: "am", name: "am", description: "Account Manager" },
  { id: "am_ceo", name: "am_ceo", description: "AM CEO" },
  { id: "data_entry", name: "data_entry", description: "Data Entry" },
  { id: "client", name: "client", description: "Client" },
  { id: "user", name: "user", description: "General User" },
];

async function seedRoles() {
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description ?? undefined },
      create: r,
    });
  }
  console.log("✅ Roles ready");
}

/* =========================================
   2) PERMISSIONS (single source of truth)
   - Include every permission your app uses.
   - Keep ids stable; UI/Sidebar refer to these.
========================================= */
const PERMS = [
  // Dashboards
  {
    id: "view_dashboard",
    name: "view_dashboard",
    description: "Sidebar: Dashboard",
  },
  {
    id: "data_entry_dashboard",
    name: "data_entry_dashboard",
    description: "Sidebar: Data Entry Dashboard",
  },

  // Chat (role-specific links used by sidebar)
  { id: "view_chat", name: "view_chat", description: "Sidebar: Chat" },
  {
    id: "chat_admin",
    name: "chat_admin",
    description: "Access Admin chat link",
  },
  {
    id: "chat_agent",
    name: "chat_agent",
    description: "Access Agent chat link",
  },
  { id: "chat_am", name: "chat_am", description: "Access AM chat link" },
  {
    id: "chat_am_ceo",
    name: "chat_am_ceo",
    description: "Access AM CEO chat link",
  },
  {
    id: "chat_client",
    name: "chat_client",
    description: "Access Client chat link",
  },
  {
    id: "chat_data_entry",
    name: "chat_data_entry",
    description: "Access Data Entry chat link",
  },

  {
    id: "data_entry_clients_create",
    name: "data_entry_clients_create",
    description: "Access data_entry_clients_create",
  },

  { id: "chat_qc", name: "chat_qc", description: "Access QC chat link" },

  // Notifications
  {
    id: "view_notifications",
    name: "view_notifications",
    description: "Sidebar: Notifications",
  },

  // Clients
  {
    id: "view_clients_list",
    name: "view_clients_list",
    description: "Clients → All Clients",
  },
  {
    id: "view_clients_create",
    name: "view_clients_create",
    description: "Clients → Add Client",
  },
  {
    id: "view_am_clients_list",
    name: "view_am_clients_list",
    description: "AM Clients → All",
  },
  {
    id: "view_am_ceo_clients_list",
    name: "view_am_ceo_clients_list",
    description: "AM CEO Clients → All",
  },
  {
    id: "view_am_clients_create",
    name: "view_am_clients_create",
    description: "AM Clients Create → Add Client",
  },

  // Packages / Distribution
  {
    id: "view_packages_list",
    name: "view_packages_list",
    description: "Packages → All Package",
  },
  {
    id: "package_create",
    name: "package_create",
    description: "Can package create",
  },
  {
    id: "package_edit",
    name: "package_edit",
    description: "Can edit packages",
  },
  {
    id: "package_delete",
    name: "package_delete",
    description: "Can delete packages",
  },
  {
    id: "view_distribution_client_agent",
    name: "view_distribution_client_agent",
    description: "Distribution → Clients to Agents",
  },

  // Tasks
  {
    id: "view_tasks_list",
    name: "view_tasks_list",
    description: "Tasks → All Tasks",
  },
  {
    id: "view_tasks_history",
    name: "view_tasks_history",
    description: "Tasks → Tasks History",
  },
  {
    id: "view_agent_tasks",
    name: "view_agent_tasks",
    description: "Agent → Tasks",
  },
  {
    id: "view_agent_tasks_history",
    name: "view_agent_tasks_history",
    description: "Agent → Tasks History",
  },
  {
    id: "view_social_activities",
    name: "view_social_activities",
    description: "Agent → Social Activities",
  },

  // QC
  {
    id: "view_qc_dashboard",
    name: "view_qc_dashboard",
    description: "QC → Dashboard",
  },
  { id: "view_qc_review", name: "view_qc_review", description: "QC → Review" },

  // Agents
  {
    id: "view_agents_list",
    name: "view_agents_list",
    description: "Agents → All Agents",
  },
  {
    id: "view_agents_create",
    name: "view_agents_create",
    description: "Agents → Add Agent",
  },

  // Admin/Manager
  {
    id: "view_teams_manage",
    name: "view_teams_manage",
    description: "Team Management",
  },
  {
    id: "view_role_permissions",
    name: "view_role_permissions",
    description: "Role Permissions",
  },
  {
    id: "view_user_management",
    name: "view_user_management",
    description: "User Management",
  },
  {
    id: "view_activity_logs",
    name: "view_activity_logs",
    description: "Activity Logs",
  },

  // Utility / system
  {
    id: "template_edit",
    name: "template_edit",
    description: "Can edit templates",
  },
  {
    id: "template_delete",
    name: "template_delete",
    description: "Can delete templates",
  },

  // Clients (card views)
  {
    id: "client_card_task_view",
    name: "client_card_task_view",
    description: "Client Card → Task View",
  },
  {
    id: "client_card_client_view",
    name: "client_card_client_view",
    description: "Client Card → Client View",
  },

  {
    id: "user_impersonate",
    name: "user_impersonate",
    description: "Can impersonate another user",
  },
  { id: "user_edit", name: "user_edit", description: "Can edit users" },
  { id: "user_view", name: "user_view", description: "Can view users" },
  { id: "user_delete", name: "user_delete", description: "Can delete users" },

  { id: "view_sales", name: "view_sales", description: "Sidebar: Sales" },
];

async function seedPermissions() {
  for (const p of PERMS) {
    await prisma.permission.upsert({
      where: { id: p.id },
      update: { name: p.name, description: p.description ?? undefined },
      create: p,
    });
  }
  console.log("✅ Permissions ready");
}

/* =========================================
   3) ROLE → PERMISSIONS
   - Admin gets exactly the screenshot-checked set.
   - Others mirror your old sidebar defaults.
========================================= */
const ADMIN_PERMS: string[] = [
  "chat_admin",
  "package_create",
  "package_edit",
  "package_delete",
  "template_edit",
  "template_delete",
  "user_delete",
  "user_edit",
  "user_view",
  "user_impersonate",
  "view_activity_logs",

  "view_agents_create",
  "view_agents_list",
  "view_clients_create",
  "view_clients_list",
  "view_dashboard",
  "view_distribution_client_agent",
  "view_notifications",
  "view_packages_list",
  "view_role_permissions",
  "view_teams_manage",
  "view_user_management",
];

const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  admin: ADMIN_PERMS,

  manager: [
    "view_dashboard",
    "view_clients_list",
    "view_clients_create",
    "view_packages_list",
    "view_distribution_client_agent",
    "view_tasks_list",
    "view_agents_list",
    "view_agents_create",
    "view_teams_manage",
    "view_qc_dashboard",
    "view_qc_review",
    "view_user_management",
    "view_activity_logs",
    "view_notifications",
    "chat_admin",
  ],

  agent: [
    "view_dashboard",
    "view_agent_tasks",
    "view_agent_tasks_history",
    "view_social_activities",
    "view_notifications",
    "chat_agent",
  ],

  qc: [
    "view_dashboard",
    "view_qc_dashboard",
    "view_qc_review",
    "view_notifications",
    "chat_qc",
  ],

  am: [
    "view_dashboard",
    "view_am_clients_list",
    "view_am_clients_create",
    "view_notifications",
    "chat_am",
  ],

  am_ceo: [
    "view_dashboard",
    "view_am_ceo_clients_list",
    "view_notifications",
    "chat_am_ceo",
    "view_sales",
  ],

  data_entry: [
    "data_entry_dashboard",
    "view_packages_list",
    "view_notifications",
    "chat_data_entry",
  ],

  client: ["view_dashboard", "view_notifications", "chat_client"],

  user: ["view_dashboard"],
};

async function assignRolePermissions() {
  for (const [roleName, permIds] of Object.entries(ROLE_PERMISSION_MAP)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) continue;

    for (const permissionId of permIds) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }
  console.log("✅ Role → Permissions mapping ready");
}

/* =========================================
   4) TEAMS (optional demo data)
========================================= */
const TEAMS = [
  { id: "asset-team", name: "Asset Team", description: "Asset Team" },
  {
    id: "backlinks-team",
    name: "Backlinks Team",
    description: "Backlinks Team",
  },
  {
    id: "content-studio-team",
    name: "Content Studio Team",
    description: "Content Studio Team",
  },
  {
    id: "content-writing",
    name: "Content Writing",
    description: "Content Writing",
  },
  {
    id: "developer-team",
    name: "Developer Team",
    description: "Developer Team",
  },
  {
    id: "graphics-design-team",
    name: "Graphics Design Team",
    description: "Graphics Design Team",
  },
  {
    id: "monitoring-team",
    name: "Monitoring Team",
    description: "Monitoring Team",
  },
  { id: "qc-team", name: "QC Team", description: "QC Team" },
  { id: "social-team", name: "Social Team", description: "Social Team" },
];

async function seedTeams() {
  for (const t of TEAMS) {
    await prisma.team.upsert({
      where: { id: t.id },
      update: { name: t.name, description: t.description ?? undefined },
      create: t,
    });
  }
  console.log("✅ Teams ready");
}

/* =========================================
   5) USERS (+ credentials Account creation)
   - Keep passwords only for local/dev.
========================================= */
type SeedUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  roleName: string;
};

const USERS: SeedUser[] = [
  {
    id: "user-admin",
    name: "Admin User",
    email: "admin@example.com",
    password: "admin123",
    roleName: "admin",
  },

  {
    id: "user-agent",
    name: "Agent User",
    email: "agent@example.com",
    password: "agent123",
    roleName: "agent",
  },

  {
    id: "user-qc",
    name: "QC User",
    email: "qc@example.com",
    password: "qc123",
    roleName: "qc",
  },

  {
    id: "user-manager",
    name: "Manager User",
    email: "manager@example.com",
    password: "manager123",
    roleName: "manager",
  },

  {
    id: "user-am",
    name: "AM User",
    email: "am@example.com",
    password: "am123",
    roleName: "am",
  },
  {
    id: "user-am-ceo",
    name: "AM CEO User",
    email: "am_ceo@example.com",
    password: "amceo123",
    roleName: "am_ceo",
  },
  {
    id: "user-data-entry",
    name: "Data Entry User",
    email: "dataentry@example.com",
    password: "dataentry123",
    roleName: "data_entry",
  },
];

// NOTE: This assumes your Prisma `Account` model has these fields:
// id, accountId, providerId, userId, accessToken, refreshToken, password, createdAt, updatedAt
// If your schema uses different names (e.g., provider, providerAccountId), rename below accordingly.
async function upsertCredentialsAccount(
  tx: PrismaClient,
  userId: string,
  roleName: string,
  hashedPassword: string
) {
  const existing = await tx.account.findFirst({
    where: { userId, providerId: "credentials" },
  });

  if (existing) {
    await tx.account.update({
      where: { id: existing.id },
      data: {
        accessToken: `token-${roleName}`,
        refreshToken: `refresh-${roleName}`,
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });
  } else {
    await tx.account.create({
      data: {
        id: `account-${roleName}`,
        accountId: `account-${roleName}`,
        providerId: "credentials",
        userId,
        accessToken: `token-${roleName}`,
        refreshToken: `refresh-${roleName}`,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
}

async function seedUsers() {
  for (const u of USERS) {
    const hashed = await bcrypt.hash(u.password, 10);

    await prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({ where: { name: u.roleName } });
      if (!role) throw new Error(`Role not found: ${u.roleName}`);

      const [firstName, lastName = ""] = u.name.split(" ");

      const createdUser = await tx.user.upsert({
        where: { email: u.email },
        update: {
          name: u.name,
          passwordHash: hashed,
          roleId: role.id,
          status: "active",
          firstName,
          lastName,
          emailVerified: true,
          updatedAt: new Date(),
        },
        create: {
          id: u.id,
          name: u.name,
          email: u.email,
          passwordHash: hashed,
          emailVerified: true,
          roleId: role.id,
          status: "active",
          firstName,
          lastName,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await upsertCredentialsAccount(tx, createdUser.id, u.roleName, hashed);

      console.log(`👤 User ready: ${u.email} (${u.roleName})`);
    });
  }
}

/* =========================================
   6) MAIN
========================================= */
async function main() {
  await seedRoles();
  await seedPermissions();
  await assignRolePermissions();
  await seedTeams();
  await seedUsers();
  console.log("🎉 All seeders completed");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
