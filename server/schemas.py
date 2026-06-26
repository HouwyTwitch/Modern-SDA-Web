"""Pydantic request/response models."""
from __future__ import annotations

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    email: str
    user_id: str


class AccountOut(BaseModel):
    id: str
    name: str
    steamId: str
    avatarColor: str
    avatarUrl: str | None
    proxy: str | None
    status: str
    favorite: bool
    hasIdentity: bool
    hasSession: bool
    lastConfirmation: float | None
    lastLogin: float | None
    createdAt: float | None


class AccountWithCode(AccountOut):
    code: str
    codeExpiresIn: int


class CodeOut(BaseModel):
    id: str
    code: str
    codeExpiresIn: int


class AddAccountRequest(BaseModel):
    # From a parsed .maFile (or manual entry).
    name: str | None = None
    steamId: str = ""
    shared_secret: str
    identity_secret: str | None = None
    account_name: str | None = None
    password: str | None = None
    refresh_token: str | None = None
    proxy: str | None = None


class UpdateAccountRequest(BaseModel):
    name: str | None = None
    proxy: str | None = None
    favorite: bool | None = None


class SteamLoginRequest(BaseModel):
    password: str | None = None  # if omitted, uses stored password
    remember: bool = False  # store the password (encrypted) for automatic re-login


class RevealRequest(BaseModel):
    password: str  # account-vault password (user's login password)


class QrApproveRequest(BaseModel):
    challenge_url: str
    confirm: bool = True


class ActRequest(BaseModel):
    action: str  # "allow" | "cancel"
    nonce: str | None = None  # confirmation key; lets us act without re-listing


# ---- create new authenticator (enrollment) ----
class EnrollLoginRequest(BaseModel):
    username: str
    password: str


class EnrollConfirmRequest(BaseModel):
    enrollId: str
    emailCode: str | None = None


class EnrollFinalizeRequest(BaseModel):
    enrollId: str
    smsCode: str


class EnrollCancelRequest(BaseModel):
    enrollId: str


class EnrollMoveStartRequest(BaseModel):
    enrollId: str


class EnrollMoveContinueRequest(BaseModel):
    enrollId: str
    smsCode: str | None = None
