/// What the LG C4's player can play, told to Jellyfin so it direct plays what it can, copies the
/// video and converts only the audio when it must, and transcodes only as a last resort.
/// (Starting point from LG's published codec list; tune against the playback matrix on the TV.)
import type { DeviceProfile } from "@jellyfin/sdk/lib/generated-client/models";
import { PLATFORM, type Platform } from "../platform/platform";

export const DEFAULT_MAX_BITRATE = 120_000_000;

const CONTAINERS = "mkv,mp4,m4v,mov,ts,m2ts,webm";
const VIDEO = "h264,hevc,vp9,av1";
const AUDIO = "aac,ac3,eac3,mp3,flac,opus,vorbis,pcm_s16le,pcm_s24le";
/// What the TV shows for each kind of picture: plain, HDR10, HLG and Dolby Vision (its
/// HDR10-compatible layers included).
const RANGES = "SDR|HDR10|HLG|DOVI|DOVIWithHDR10|DOVIWithHLG|DOVIWithSDR";

/// Text subtitles come as cue lists the app draws itself (phase 4); picture formats can't be
/// drawn here yet, so the server burns them into the video.
const TEXT_SUBTITLES = ["srt", "subrip", "vtt", "webvtt", "ass", "ssa", "sub", "mov_text", "ttml"];
const IMAGE_SUBTITLES = ["pgssub", "pgs", "dvdsub", "dvbsub", "xsub"];

/// The Fire HD 8 tablet (MediaTek MT8168, Chrome WebView): 1080p, 8-bit, SDR H.264 is the safe
/// ground. HEVC, VP9, AV1, HDR and Dolby Vision are left out until the setup check's codec table
/// says the tablet handles them; the server converts those, and converts surround audio the
/// WebView can't decode (AC-3, E-AC-3, DTS) to AAC.
export const TABLET_MAX_BITRATE = 20_000_000;

function tabletProfile(maxBitrate: number): DeviceProfile {
  const limit = Math.min(maxBitrate, TABLET_MAX_BITRATE);
  return {
    Name: "Wavetile TV Fire HD 8",
    MaxStreamingBitrate: limit,
    MaxStaticBitrate: limit,
    MusicStreamingTranscodingBitrate: 192_000,
    DirectPlayProfiles: [{ Type: "Video", Container: "mp4,m4v,mkv,webm", VideoCodec: "h264", AudioCodec: "aac,mp3,opus,flac,vorbis" }],
    TranscodingProfiles: [
      {
        Type: "Video",
        Container: "ts",
        Protocol: "hls",
        VideoCodec: "h264",
        AudioCodec: "aac",
        Context: "Streaming",
        MaxAudioChannels: "2",
        MinSegments: 1,
        SegmentLength: 6,
        BreakOnNonKeyFrames: true,
      },
    ],
    ContainerProfiles: [],
    CodecProfiles: [
      {
        Type: "Video",
        Codec: "h264",
        Conditions: [
          { Condition: "LessThanEqual", Property: "VideoLevel", Value: "41", IsRequired: true },
          { Condition: "LessThanEqual", Property: "VideoBitDepth", Value: "8", IsRequired: true },
          { Condition: "LessThanEqual", Property: "Width", Value: "1920", IsRequired: true },
          { Condition: "LessThanEqual", Property: "Height", Value: "1080", IsRequired: true },
          { Condition: "NotEquals", Property: "IsAnamorphic", Value: "true", IsRequired: false },
        ],
      },
      {
        Type: "Video",
        Conditions: [{ Condition: "EqualsAny", Property: "VideoRangeType", Value: "SDR", IsRequired: true }],
      },
      {
        Type: "VideoAudio",
        Conditions: [{ Condition: "LessThanEqual", Property: "AudioChannels", Value: "6", IsRequired: true }],
      },
    ],
    SubtitleProfiles: [
      ...TEXT_SUBTITLES.map((Format) => ({ Format, Method: "External" as const })),
      ...IMAGE_SUBTITLES.map((Format) => ({ Format, Method: "Encode" as const })),
    ],
  };
}

export function deviceProfile(maxBitrate = DEFAULT_MAX_BITRATE, platform: Platform = PLATFORM): DeviceProfile {
  if (platform === "android") return tabletProfile(maxBitrate);
  return {
    Name: "Wavetile TV LG webOS",
    MaxStreamingBitrate: maxBitrate,
    MaxStaticBitrate: maxBitrate,
    MusicStreamingTranscodingBitrate: 192_000,
    DirectPlayProfiles: [{ Type: "Video", Container: CONTAINERS, VideoCodec: VIDEO, AudioCodec: AUDIO }],
    TranscodingProfiles: [
      {
        Type: "Video",
        Container: "ts",
        Protocol: "hls",
        VideoCodec: "hevc,h264",
        AudioCodec: "aac,ac3,eac3",
        Context: "Streaming",
        MaxAudioChannels: "6",
        MinSegments: 1,
        SegmentLength: 6,
        BreakOnNonKeyFrames: true,
      },
    ],
    ContainerProfiles: [],
    CodecProfiles: [
      {
        Type: "Video",
        Codec: "h264",
        Conditions: [
          { Condition: "LessThanEqual", Property: "VideoLevel", Value: "52", IsRequired: false },
          { Condition: "NotEquals", Property: "IsAnamorphic", Value: "true", IsRequired: false },
        ],
      },
      {
        Type: "Video",
        Conditions: [{ Condition: "EqualsAny", Property: "VideoRangeType", Value: RANGES, IsRequired: false }],
      },
      {
        Type: "VideoAudio",
        Conditions: [{ Condition: "LessThanEqual", Property: "AudioChannels", Value: "8", IsRequired: false }],
      },
    ],
    SubtitleProfiles: [
      ...TEXT_SUBTITLES.map((Format) => ({ Format, Method: "External" as const })),
      ...IMAGE_SUBTITLES.map((Format) => ({ Format, Method: "Encode" as const })),
    ],
  };
}
