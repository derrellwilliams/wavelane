/// What the LG C4's player can play, told to Jellyfin so it direct plays what it can, copies the
/// video and converts only the audio when it must, and transcodes only as a last resort.
/// (Starting point from LG's published codec list; tune against the playback matrix on the TV.)
import type { DeviceProfile } from "@jellyfin/sdk/lib/generated-client/models";

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

export function deviceProfile(maxBitrate = DEFAULT_MAX_BITRATE): DeviceProfile {
  return {
    Name: "Wavelane LG webOS",
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
