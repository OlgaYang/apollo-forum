# Forum Server
This forum graphQL backend server using apollo server.

Export 3 endpoini for different scenarios
- Query/Mutation: http://localhost:4000/graphql
- Subscription: ws://localhost:4000/graphql
- Metric: http://localhost:4000/metrics

All schema, refer to this file `schema.graphql`
All datasource in folder `/src/datasource`, currently using in-memory store data

## Project Setup

```sh
npm install
npm run codegen
```

### Compile for Development

```sh
npm start
```
