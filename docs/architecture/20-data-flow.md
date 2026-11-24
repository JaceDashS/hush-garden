# Data Flow

The private garden processes position and audio on the device. In the public garden the server owns layout, presence and nearby chat. The client sends position and chat updates over the public garden socket, renders server state and synthesizes sound locally.

```mermaid
flowchart LR
    A[Public garden client] --> B[Garden socket]
    B[Garden socket] --> C[Server layout presence and chat]
    A[Public garden client] --> D[Local audio synthesis]
    E[Private garden] --> D[Local audio synthesis]
```

See [Architecture Overview](10-overview.md).
