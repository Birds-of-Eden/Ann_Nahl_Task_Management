// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seedRoles() {
  // name ফিল্ডটা unique, তাই upsert name দিয়ে; create করলে id সেট হবে
  const roles = [
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

  for (const r of roles) {
    await prisma.role.upsert({
      where: { name: r.name }, // ✅ name দিয়ে upsert
      update: { description: r.description ?? undefined },
      create: r, // create হলে id-ও সেট হবে
    });
  }
  console.log("✅ Roles ready");
}

async function seedPermissions() {
  const permissions = [
    // ---- Existing / common ----
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
    {
      id: "user_impersonate",
      name: "user_impersonate",
      description: "Can impersonate another user",
    },

    {
      id: "view_dashboard",
      name: "view_dashboard",
      description: "Sidebar: Dashboard",
    },
    { id: "view_chat", name: "view_chat", description: "Sidebar: Chat" },
    {
      id: "view_notifications",
      name: "view_notifications",
      description: "Sidebar: Notifications",
    },

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
      id: "view_packages_list",
      name: "view_packages_list",
      description: "Packages → All Package",
    },
    {
      id: "view_distribution_client_agent",
      name: "view_distribution_client_agent",
      description: "Distribution → Clients to Agents",
    },

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
      id: "view_qc_review",
      name: "view_qc_review",
      description: "QC → Review / QC Review leaf",
    },
    {
      id: "view_qc_dashboard",
      name: "view_qc_dashboard",
      description: "QC → QC Dashboard",
    },

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
    {
      id: "view_teams_manage",
      name: "view_teams_manage",
      description: "Team Management",
    },
    {
      id: "view_role_permissions",
      name: "view_role_permissions",
      description: "Role Permissions page",
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

    // New chat + data-entry dashboard permissions
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
    { id: "chat_qc", name: "chat_qc", description: "Access QC chat link" },
    {
      id: "data_entry_dashboard",
      name: "data_entry_dashboard",
      description: "Access Data Entry dashboard link",
    },
    {
      id: "user_edit",
      name: "user_edit",
      description: "Can edit users",
    },
    {
      id: "user_view",
      name: "user_view",
      description: "Can view users",
    },
    {
      id: "user_delete",
      name: "user_delete",
      description: "Can delete users",
    },
  ];

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { id: p.id }, // id unique, তাই id দিয়ে upsert
      update: { name: p.name, description: p.description ?? undefined },
      create: p,
    });
  }
  console.log("✅ Permissions ready");

  // admin → all permissions
  const adminRole = await prisma.role.findUnique({ where: { name: "admin" } });
  if (!adminRole) throw new Error("admin role not found");

  for (const p of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: adminRole.id, permissionId: p.id },
      },
      update: {},
      create: { roleId: adminRole.id, permissionId: p.id },
    });
  }
  console.log("✅ Admin grants ready");
}

async function seedTeams() {
  // team id গুলো স্টেবল রাখতে id দিয়ে upsert
  const teams = [
    { id: "asset-team", name: "Asset Team", description: "Asset Team" },
    {
      id: "backlinks-team",
      name: "Backlinks Team",
      description: "Backlinks Team",
    },
    {
      id: "completedcom-",
      name: "Completed.com",
      description: "Completed.com Team Description",
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
      description: "Graphics Design Team Description",
    },
    {
      id: "monitoring-team",
      name: "Monitoring Team",
      description: "Monitoring Team Description",
    },
    { id: "qc-team", name: "QC Team", description: "QC Team Description" },
    {
      id: "review-removal-team",
      name: "Review Removal Team",
      description: "Review Removal Team Description",
    },
    { id: "social-team", name: "Social Team", description: "Social Team" },
    {
      id: "summary-report-team",
      name: "Summary Report Team",
      description: "Summary Report Team",
    },
    {
      id: "youtube-video-optimizer-",
      name: "Youtube Video Optimizer",
      description: "Youtube Video Optimizer Team Description",
    },
  ];

  for (const t of teams) {
    await prisma.team.upsert({
      where: { id: t.id },
      update: { name: t.name, description: t.description ?? undefined },
      create: t,
    });
  }
  console.log("✅ Teams ready");
}

async function seedUsers() {
  const users = [
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
      id: "user-manager",
      name: "Manager User",
      email: "manager@example.com",
      password: "manager123",
      roleName: "manager",
    },
    {
      id: "user-qc",
      name: "QC User",
      email: "qc@example.com",
      password: "qc123",
      roleName: "qc",
    },
  ];

  for (const u of users) {
    const role = await prisma.role.findUnique({ where: { name: u.roleName } });
    if (!role) throw new Error(`role not found: ${u.roleName}`);

    const hashed = await bcrypt.hash(u.password, 10);
    const [firstName, lastName = ""] = u.name.split(" ");

    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        passwordHash: hashed,
        roleId: role.id,
        status: "active",
        firstName,
        lastName,
        emailVerified: true,
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
      },
    });

    // credentials account upsert (providerId + userId দিয়ে খুঁজে নিন)
    const existing = await prisma.account.findFirst({
      where: { userId: user.id, providerId: "credentials" },
    });

    if (existing) {
      await prisma.account.update({
        where: { id: existing.id },
        data: {
          accessToken: `token-${u.roleName}`,
          refreshToken: `refresh-${u.roleName}`,
          password: hashed,
        },
      });
    } else {
      await prisma.account.create({
        data: {
          id: `account-${u.roleName}`,
          accountId: `account-${u.roleName}`,
          providerId: "credentials",
          userId: user.id,
          accessToken: `token-${u.roleName}`,
          refreshToken: `refresh-${u.roleName}`,
          password: hashed,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    console.log(`👤 User ready: ${u.email} (${u.roleName})`);
  }
}

async function main() {
  await seedRoles();
  await seedPermissions();
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
