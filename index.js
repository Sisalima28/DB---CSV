const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const fastcsv = require('fast-csv');
const multer = require('multer');

const app = express();
const port = 3000;

// Configuración de la conexión a PostgreSQL
const pool = new Pool({
    host: '127.0.0.1',
    user: 'postgres',
    password: 'steven2004',
    database: 'Hr',
    port: '5432'
});

// Configuración de multer para manejar archivos CSV
const upload = multer({ dest: 'uploads/' });

// Ruta para exportar la tabla a CSV
app.get('/exportar', async (req, res) => {
    try {
        const query = 'SELECT * FROM employees';
        const client = await pool.connect();
        const result = await client.query(query);
        client.release();

        const csvStream = fastcsv.format({ headers: true });
        const writableStream = fs.createWriteStream('uploads/empleados.csv');

        writableStream.on('finish', () => {
            res.download(path.join(__dirname, 'uploads/empleados.csv'));
        });

        csvStream.pipe(writableStream);
        result.rows.forEach((row) => {
            csvStream.write(row);
        });
        csvStream.end();
    } catch (error) {
        console.error('Error al exportar tabla:', error);
        res.status(500).send('Error al exportar tabla');
    }
});

app.post('/import', upload.single('file'), (req, res) => {
    const filePath = req.file.path;

    const data = [];
    fs.createReadStream(filePath)
        .pipe(fastcsv.parse({ headers: true }))
        .on('data', row => {
            data.push(row);
        })
        .on('end', async() => {
            try {
                const client = await pool.connect();

                await Promise.all(
                    data.map(row => {
                        return client.query(
                            'INSERT INTO region (region_id, region_name) VALUES ($1, $2) ON CONFLICT (region_id) DO NOTHING', [row.region_id, row.region_name]
                        );
                    })
                );

                client.release();
                res.send('Datos importados correctamente');
            } catch (error) {
                console.error('Error al importar datos:', error);
                res.status(500).send('Error al importar datos');
            } finally {
                fs.unlinkSync(filePath); // Elimina el archivo después de procesarlo
            }
        });
});

// Inicia el servidor
app.listen(port, () => {
    console.log(`Servidor en funcionamiento en http://localhost:${port}`);
});
