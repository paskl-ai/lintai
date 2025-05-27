export interface IUserState {
  userInfo: IUser | null
}

export interface IAuthUser {
  loggedInUser: IUser | null
  token: string | null
}

export interface IUser {
  id?: string
  name: string
  email: string
}

export interface ILoginUser {
  email: string
  password: string
}

export interface IUserProfile {
  userInfo: {
    email: string
    id: string
    profile: string
    role: string
    fullName: string
  }
}
