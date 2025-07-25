import { MongoClient, ObjectId } from 'mongodb';

export class dbManager {
    static uri = "mongodb://localhost:27017";
    static client = undefined;
    static db = undefined;
    static dbName = "eantion";

    static async openDb() {
        this.client = new MongoClient(this.uri);
        await this.client.connect();
        this.db = this.client.db(this.dbName);
    }

    static async closeDb() {
        await this.client.close();
    }

    static async create(collection, doc) {
        await this.db.collection(collection).insertOne(doc);
        console.log("Documento creado en colección", collection);
    }

    static async list(collection) {
        return await this.db.collection(collection).find().toArray();
    }

    static async show(collection, _id) {
        return await this.db.collection(collection).findOne({ _id: new ObjectId(_id) });
    }

    static async update(collection, _id, doc) {
        const result = await this.db.collection(collection).updateOne(
            { _id: new ObjectId(_id) },
            { $set: doc }
        );
        if(result.modifiedCount > 0) {
            console.log("Documento actualizado en colección", collection);
        } else {
            console.log("No se pudo actualizar el documento");
        }
        return result;
    }

    static async delete(collection, _id) {
        const result = await this.db.collection(collection).deleteOne({ _id: new ObjectId(_id) });
        if(result.deletedCount > 0) {
            console.log("Documento eliminado de colección", collection);
        } else {
            console.log("No se pudo eliminar el documento");
        }
        return result;
    }
}

export default dbManager;