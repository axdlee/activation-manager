import { Prisma, PrismaClient } from '@prisma/client'

import { DEFAULT_PROJECT_KEY, DEFAULT_PROJECT_NAME } from './dev-bootstrap'
import { normalizeProjectKeyForCreate } from './project-key'

export type DbClient = PrismaClient | Prisma.TransactionClient

type CreateProjectInput = {
  name: string
  projectKey: string
  description?: string | null
}

type UpdateProjectStatusInput = {
  id: number
  isEnabled: boolean
}

type UpdateProjectNameInput = {
  id: number
  name: string
}

type UpdateProjectDescriptionInput = {
  id: number
  description?: string | null
}

type DeleteProjectInput = {
  id: number
}

function normalizeOptionalText(value?: string | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeProjectKey(projectKey?: string) {
  return (projectKey || DEFAULT_PROJECT_KEY).trim()
}

export async function resolveProject(client: DbClient, projectKey?: string) {
  const normalizedProjectKey = normalizeProjectKey(projectKey)
  const project = await client.project.findUnique({
    where: {
      projectKey: normalizedProjectKey,
    },
  })

  if (!project) {
    throw new Error(`项目不存在: ${normalizedProjectKey}`)
  }

  if (!project.isEnabled) {
    throw new Error(`项目已停用: ${normalizedProjectKey}`)
  }

  return project
}

async function getProjectById(client: DbClient, id: number) {
  return client.project.findUnique({
    where: {
      id,
    },
  })
}

export async function findProjectByProjectKey(client: DbClient, projectKey?: string) {
  const normalizedProjectKey = projectKey?.trim()

  if (!normalizedProjectKey) {
    return null
  }

  const project = await client.project.findUnique({
    where: {
      projectKey: normalizedProjectKey,
    },
    select: {
      id: true,
    },
  })

  if (!project) {
    throw new Error(`项目不存在: ${normalizedProjectKey}`)
  }

  return project
}

export async function ensureDefaultProjectRecord(client: DbClient) {
  return client.project.upsert({
    where: {
      projectKey: DEFAULT_PROJECT_KEY,
    },
    update: {
      name: DEFAULT_PROJECT_NAME,
      isEnabled: true,
    },
    create: {
      name: DEFAULT_PROJECT_NAME,
      projectKey: DEFAULT_PROJECT_KEY,
      description: '系统兼容默认项目',
      isEnabled: true,
    },
  })
}

export async function listProjects(client: DbClient) {
  return client.project.findMany({
    orderBy: [{ isEnabled: 'desc' }, { createdAt: 'asc' }],
  })
}

export async function createProject(client: DbClient, input: CreateProjectInput) {
  const name = normalizeOptionalText(input.name)
  const projectKey = normalizeProjectKeyForCreate(input.projectKey)
  const description = normalizeOptionalText(input.description) || null

  if (!name) {
    throw new Error('项目名称不能为空')
  }

  return client.project.create({
    data: {
      name,
      projectKey,
      description,
      isEnabled: true,
    },
  })
}

export async function updateProjectStatus(client: DbClient, input: UpdateProjectStatusInput) {
  const project = await getProjectById(client, input.id)

  if (!project) {
    throw new Error('项目不存在')
  }

  if (project.projectKey === DEFAULT_PROJECT_KEY && !input.isEnabled) {
    throw new Error('默认项目不允许停用')
  }

  return client.project.update({
    where: {
      id: project.id,
    },
    data: {
      isEnabled: input.isEnabled,
    },
  })
}

export async function updateProjectName(client: DbClient, input: UpdateProjectNameInput) {
  const project = await getProjectById(client, input.id)

  if (!project) {
    throw new Error('项目不存在')
  }

  if (project.projectKey === DEFAULT_PROJECT_KEY) {
    throw new Error('默认项目不允许修改名称')
  }

  const name = input.name.trim()

  if (!name) {
    throw new Error('项目名称不能为空')
  }

  return client.project.update({
    where: {
      id: project.id,
    },
    data: {
      name,
    },
  })
}

export async function updateProjectDescription(client: DbClient, input: UpdateProjectDescriptionInput) {
  const project = await getProjectById(client, input.id)

  if (!project) {
    throw new Error('项目不存在')
  }

  return client.project.update({
    where: {
      id: project.id,
    },
    data: {
      description: input.description?.trim() || null,
    },
  })
}

export async function deleteProject(client: DbClient, input: DeleteProjectInput) {
  const project = await getProjectById(client, input.id)

  if (!project) {
    throw new Error('项目不存在')
  }

  if (project.projectKey === DEFAULT_PROJECT_KEY) {
    throw new Error('默认项目不允许删除')
  }

  const codeCount = await client.activationCode.count({
    where: {
      projectId: project.id,
    },
  })

  if (codeCount > 0) {
    throw new Error('项目下仍有激活码，无法删除')
  }

  return client.project.delete({
    where: {
      id: project.id,
    },
  })
}
