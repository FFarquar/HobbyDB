import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcryptjs";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "hobbydb-stage";

const timestamp = new Date().toISOString();

const passwordHash = await bcrypt.hash("Password123", 12);

const users = [
  {
    PK: "USER#Dean_P",
    SK: "PROFILE",
    GSI1PK: "USER",
    GSI1SK: "USER#Dean_P",
    loginID: "Dean_P",
    displayName: "Dean_P",
    passwordHash,
    role: "ADMIN",
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];

for (const user of users) {
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: user,
    })
  );
  console.log("Inserted:", user.loginID);
}
