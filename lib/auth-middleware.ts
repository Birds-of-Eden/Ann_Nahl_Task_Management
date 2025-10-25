// lib/auth-middleware.ts
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export type UserRole = "admin" | "manager" | "am" | "agent";

export interface AuthContext {
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    roleName: string | null;
  };
}

/**
 * Extract user ID from request headers or query params
 */
export function extractUserId(request: NextRequest): string | null {
  // Try x-user-id header first
  const headerUserId = request.headers.get("x-user-id");
  if (headerUserId) return headerUserId;

  // Try x-actor-id header
  const actorId = request.headers.get("x-actor-id");
  if (actorId) return actorId;

  // Try query param
  const queryUserId = request.nextUrl.searchParams.get("userId");
  if (queryUserId) return queryUserId;

  const queryActorId = request.nextUrl.searchParams.get("actorId");
  if (queryActorId) return queryActorId;

  return null;
}

/**
 * Authenticate user and verify they exist
 */
export async function authenticateUser(
  request: NextRequest
): Promise<AuthContext> {
  const userId = extractUserId(request);

  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  return {
    userId: user.id,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      roleName: user.role?.name || null,
    },
  };
}

/**
 * Check if user has required role
 */
export function hasRole(
  authContext: AuthContext,
  allowedRoles: UserRole[]
): boolean {
  if (!authContext.user.roleName) return false;
  return allowedRoles.includes(authContext.user.roleName.toLowerCase() as UserRole);
}

/**
 * Require specific roles (throws if not authorized)
 */
export function requireRole(
  authContext: AuthContext,
  allowedRoles: UserRole[]
): void {
  if (!hasRole(authContext, allowedRoles)) {
    throw new Error("FORBIDDEN");
  }
}

/**
 * Check if user owns or manages a client
 */
export async function canAccessClient(
  userId: string,
  clientId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: {
        select: { name: true },
      },
    },
  });

  if (!user) return false;

  // Admins and managers can access all clients
  if (user.role?.name === "admin" || user.role?.name === "manager") {
    return true;
  }

  // AMs can access their assigned clients
  if (user.role?.name === "am") {
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        amId: userId,
      },
    });
    return !!client;
  }

  // Agents can access clients they're assigned to through assignments
  const assignment = await prisma.assignment.findFirst({
    where: {
      clientId,
      template: {
        templateTeamMembers: {
          some: {
            agentId: userId,
          },
        },
      },
    },
  });

  return !!assignment;
}

/**
 * Check if user can access an assignment
 */
export async function canAccessAssignment(
  userId: string,
  assignmentId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: {
        select: { name: true },
      },
    },
  });

  if (!user) return false;

  // Admins and managers can access all assignments
  if (user.role?.name === "admin" || user.role?.name === "manager") {
    return true;
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      client: true,
      template: {
        include: {
          templateTeamMembers: true,
        },
      },
    },
  });

  if (!assignment) return false;

  // AMs can access their client's assignments
  if (user.role?.name === "am" && assignment.client?.amId === userId) {
    return true;
  }

  // Agents can access assignments they're part of
  const isTeamMember = assignment.template?.templateTeamMembers?.some(
    (member) => member.agentId === userId
  );

  return isTeamMember || false;
}

/**
 * Check if user can modify an assignment (stricter than read access)
 */
export async function canModifyAssignment(
  userId: string,
  assignmentId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: {
        select: { name: true },
      },
    },
  });

  if (!user) return false;

  // Only admins, managers, and AMs can modify assignments
  if (user.role?.name === "admin" || user.role?.name === "manager") {
    return true;
  }

  if (user.role?.name === "am") {
    const assignment = await prisma.assignment.findFirst({
      where: {
        id: assignmentId,
        client: {
          amId: userId,
        },
      },
    });
    return !!assignment;
  }

  return false;
}

/**
 * Check if user can modify a task
 */
export async function canModifyTask(
  userId: string,
  taskId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: {
        select: { name: true },
      },
    },
  });

  if (!user) return false;

  // Admins and managers can modify all tasks
  if (user.role?.name === "admin" || user.role?.name === "manager") {
    return true;
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignment: {
        include: {
          client: true,
        },
      },
    },
  });

  if (!task) return false;

  // AMs can modify tasks for their clients
  if (user.role?.name === "am" && task.assignment?.client?.amId === userId) {
    return true;
  }

  // Agents can modify their assigned tasks
  if (task.assignedToId === userId) {
    return true;
  }

  return false;
}

/**
 * Error response helper
 */
export function getAuthErrorResponse(error: Error) {
  if (error.message === "UNAUTHORIZED") {
    return {
      status: 401,
      message: "Authentication required. Please provide valid credentials.",
    };
  }
  if (error.message === "USER_NOT_FOUND") {
    return {
      status: 401,
      message: "User not found. Please check your credentials.",
    };
  }
  if (error.message === "FORBIDDEN") {
    return {
      status: 403,
      message: "You do not have permission to perform this action.",
    };
  }
  return {
    status: 500,
    message: "Internal server error",
  };
}
