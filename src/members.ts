import type { User } from '@clerk/backend'

export interface IMember {
  id: string
  name: string
  email: string | null
  imageUrl: string
  joinedAt: string
}

export function toMember(user: User): IMember {
  const fullName = [user.firstName, user.lastName]
    .filter((part): part is string => Boolean(part))
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
  const email =
    user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)
      ?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    null

  return {
    id: user.id,
    name: fullName || user.username || email || 'Member',
    email,
    imageUrl: user.imageUrl,
    joinedAt: new Date(user.createdAt).toISOString(),
  }
}

export function sortMembers(members: IMember[], currentUserId: string): IMember[] {
  return [...members].sort((left, right) => {
    if (left.id === currentUserId) {
      return -1
    }
    if (right.id === currentUserId) {
      return 1
    }
    return left.name.localeCompare(right.name)
  })
}
