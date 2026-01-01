# NiFi Agent

Natural language NiFi flow automation using OpenAI GPT-4 function calling.

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your OPENAI_API_KEY

# Build and run
npm run build
npm start
```

## Usage

Describe your data flow in natural language:

```
You: Create a flow that reads OPC-UA sensor data and publishes it to MQTT

Agent: I'll create an OPC-UA to MQTT flow. I need a few details:

  What is the OPC-UA server endpoint URL? (e.g., opc.tcp://localhost:4840)
  > opc.tcp://192.168.1.100:4840

  What is the MQTT broker URI? (e.g., tcp://localhost:1883)
  > tcp://mqtt.mycompany.com:1883

  What MQTT topic should I publish to?
  > sensors/readings

Creating flow...
✓ Flow created successfully!
```

## Supported ETL Patterns

- **OPC-UA → MQTT**: Industrial sensor data to message broker
- **Database → MQTT**: SQL query results to MQTT
- **File → MQTT**: File-based data to MQTT
- **HTTP → MQTT**: REST API data to MQTT
- **MQTT → File/Database**: Message consumption and storage

## Commands

- `exit` - Quit the agent
- `reset` - Clear conversation and start over

## Configuration

| Variable | Description |
|----------|-------------|
| `NIFI_BASE_URL` | NiFi REST API URL (default: https://localhost:8443/nifi-api) |
| `NIFI_USERNAME` | NiFi username |
| `NIFI_PASSWORD` | NiFi password |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `OPENAI_MODEL` | Model to use (default: gpt-4) |
