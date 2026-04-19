from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


PROMPT = (
    "Analyze this audio file and provide detailed sound effect metadata in JSON format. "
    "Classify the sound, provide short and long English captions, and extract structured tags "
    "for object, action, material, texture, environment, and temporal characteristics. "
    "The filename field will be injected by the caller, so do not infer or invent a filename. "
    "A filename hint may also be provided by the caller. Use it as contextual evidence when it is semantically meaningful "
    "and consistent with the audio, especially for object names, actions, materials, or human-made sound labels. "
    "Do not copy the filename blindly. If the filename is noisy, generic, numeric, misleading, or conflicts with the audio, "
    "trust the audio first and downweight the filename. "
    "In other words: audio is the primary evidence, filename is optional supporting evidence. "
    "primary_class must be the top-level editorial category and exactly one of: "
    "ambience, SFX, music, Foley, dialogue_VO, Cinematic. "
    "second_class must be a more specific subclass label such as footsteps, cloth_rustle, "
    "door_creak, vehicle_horn, rustling_paper, or breath. "
    "Choose second_class to be useful and specific, but do not overfit to odd filename fragments. "
    "realism must be exactly one of: realistic, stylized. "
    "temporal must be exactly one of: continuous, impulsive, rhythmic. "
    "Keep short_caption_en within 10 words. Keep long_caption_en concise and practical for retrieval."
)


class TagsStructured(BaseModel):
    object: list[str] = Field(default_factory=list)
    action: list[str] = Field(default_factory=list)
    material: list[str] = Field(default_factory=list)
    texture: list[str] = Field(default_factory=list)
    environment: list[str] = Field(default_factory=list)
    temporal: Literal["continuous", "impulsive", "rhythmic"]
    editorial_role: list[str] = Field(default_factory=lambda: ["sound_effect"])
    realism: Literal["realistic", "stylized"]


class AudioMetadataResult(BaseModel):
    primary_class: Literal["ambience", "SFX", "music", "Foley", "dialogue_VO", "Cinematic"]
    second_class: str
    class_confidence: float
    short_caption_en: str
    long_caption_en: str
    tags_structured: TagsStructured


RESPONSE_JSON_SCHEMA = AudioMetadataResult.model_json_schema()
