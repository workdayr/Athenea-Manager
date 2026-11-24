"""Contratos HTTP del microservicio (camelCase, compatibles con el frontend)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class QueryScope(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_id: str = Field(alias="userId")
    role: str
    project_ids: list[int] = Field(default_factory=list, alias="projectIds")


class QueryRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    question: str = Field(min_length=1, max_length=2000)
    history: list[HistoryMessage] = Field(default_factory=list)
    scope: QueryScope
    top_k: int | None = Field(default=None, alias="topK", ge=1, le=10)


class Citation(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    project_id: int | None = Field(default=None, alias="projectId")
    document_id: str = Field(alias="documentId")
    document_title: str = Field(alias="documentTitle")
    document_type: str = Field(alias="documentType")
    section: str | None = None
    page: int | None = None
    excerpt: str


class QueryResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    answer: str
    grounded: bool
    refusal_reason: str | None = Field(default=None, alias="refusalReason")
    citations: list[Citation] = Field(default_factory=list)


class IngestRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    document_id: str | None = Field(default=None, alias="documentId")
    project_document_id: int | None = Field(default=None, alias="projectDocumentId")
    all_documents: bool = Field(default=False, alias="all")


class IngestResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    documents: int
    chunks: int
