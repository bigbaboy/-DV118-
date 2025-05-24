// chartQ10.js

async function drawChartQ10(containerSelector, tooltipElement, dataPath) { // ĐÃ SỬA: Thêm dataPath
    const vizContainer = d3.select(containerSelector);
    vizContainer.html(""); // Xóa nội dung cũ

    try {
        // Sử dụng dataPath được truyền vào để tải dữ liệu
        const allData = await d3.csv(dataPath);
        if (!allData || allData.length === 0) {
            throw new Error(`Không tải được file dữ liệu từ ${dataPath} hoặc file rỗng.`);
        }

        // 1. XỬ LÝ DỮ LIỆU:
        allData.forEach(d => {
            d.Sales = parseFloat(d.Sales);
            if (isNaN(d.Sales) || d.Sales < 0) d.Sales = 0;

            // Trích xuất tháng từ Order Date
            // Giả sử 'Order Date' có định dạng mà d3.timeParse hoặc new Date() có thể đọc
            // Ví dụ: "MM/DD/YYYY" hoặc "YYYY-MM-DD"
            // D3.js không có dt.month trực tiếp như Pandas.
            // Cần parse date trước.
            // Thử các định dạng phổ biến. Nếu Order Date của bạn có format khác, bạn cần thay đổi parser.
            let parsedDate = d3.timeParse("%m/%d/%Y")(d['Order Date']);
            if (!parsedDate) parsedDate = d3.timeParse("%Y-%m-%d")(d['Order Date']);
            if (!parsedDate && d['Order Date'] && d['Order Date'].includes(" ")) { // Ví dụ: "2011-01-01 00:00:00"
                 parsedDate = d3.timeParse("%Y-%m-%d %H:%M:%S")(d['Order Date']);
            }
             if (!parsedDate && d['Order Date'] && d['Order Date'].includes("T")) { // Ví dụ: "2011-01-01T00:00:00"
                 parsedDate = d3.isoParse(d['Order Date']);
            }


            if (parsedDate) {
                d.Month = parsedDate.getMonth() + 1; // getMonth() trả về 0-11, nên +1
            } else {
                d.Month = 0; // Gán giá trị không hợp lệ nếu không parse được date
                // console.warn("Không thể parse Order Date:", d['Order Date']);
            }

            // Đảm bảo tên cột này chính xác trong CSV
            if (typeof d['Sub-Category'] === 'undefined' || d['Sub-Category'] === null || String(d['Sub-Category']).trim() === "") {
                d['Sub-Category'] = "Không xác định";
            }
        });

        // Lọc bỏ các dòng không parse được tháng hoặc không có Sub-Category
        const validData = allData.filter(d => d.Month > 0 && d.Month <= 12 && d['Sub-Category'] !== "Không xác định");

        // Tính tổng Sales cho mỗi Sub-Category và Month (qua các năm)
        const monthlySubCategorySales = d3.rollup(validData,
            v => d3.sum(v, d => d.Sales),
            d => d['Sub-Category'],
            d => d.Month
        );

        let dataForChart = [];
        monthlySubCategorySales.forEach((monthMap, subCategory) => {
            monthMap.forEach((sales, month) => {
                dataForChart.push({
                    'Sub-Category': subCategory,
                    Month: month, 
                    Sales: sales || 0
                });
            });
        });

        if (dataForChart.length === 0) {
            vizContainer.html("<p>Không có dữ liệu hợp lệ để vẽ biểu đồ Q10.</p>");
            return;
        }

        const maxSales = d3.max(dataForChart, d => d.Sales);
        if (maxSales === 0 || isNaN(maxSales)) {
             vizContainer.html("<p>Doanh thu tối đa bằng 0 hoặc không hợp lệ, không thể tính kích thước bong bóng.</p>");
             return;
        }

        dataForChart.forEach(d => {
            // Python: bubble_data['Size'] = (bubble_data['Sales'] / max_sales) * 300
            // D3 sizes: (10, 300)
            // Chúng ta sẽ dùng d3.scaleSqrt() cho kích thước bong bóng dựa trên diện tích
            d.Size_Value = d.Sales; // Giữ lại giá trị gốc để scale
        });
        // console.log("Data for Bubble Chart Q10:", dataForChart);

        // --- BẮT ĐẦU CODE D3.JS VẼ SCATTER PLOT (BUBBLE CHART) ---
        const containerRect = vizContainer.node().getBoundingClientRect();
        const baseWidth = containerRect.width > 0 ? containerRect.width * 0.98 : 700;
        const baseHeight = 500; // Chiều cao có thể lớn hơn để chứa nhiều Sub-Category

        const chartWidth = Math.max(400, baseWidth);
        const chartHeight = Math.max(350, baseHeight);
        
        const margin = { top: 50, right: 30, bottom: 60, left: 150 }; // Tăng left margin cho tên Sub-Category dài

        const width = chartWidth - margin.left - margin.right;
        const height = chartHeight - margin.top - margin.bottom;

        const svg = vizContainer.append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // X Axis (Tháng)
        const x = d3.scaleLinear() // Dùng linear scale cho tháng (1-12)
            .domain([0.5, 12.5]) // Để các tháng nằm giữa các tick
            .range([0, width]);

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x)
                .ticks(12) // 12 tháng
                .tickFormat(d => `${d3.format("02")(d)}`) // Format tháng: 01, 02, ...
            )
            .selectAll("text")
                .style("font-size", "10px");
        
        // Y Axis (Sub-Category)
        // Lấy danh sách Sub-Category duy nhất và sắp xếp (tùy chọn)
        const subCategories = Array.from(new Set(dataForChart.map(d => d['Sub-Category']))).sort(d3.ascending);
        const y = d3.scaleBand()
            .range([0, height])
            .domain(subCategories)
            .padding(0.1);

        svg.append("g")
            .call(d3.axisLeft(y).tickSize(0).tickPadding(5))
            .selectAll("text")
                .style("font-size", "9px");

        svg.append("text") // Nhãn trục Y
            .attr("transform", "rotate(-90)")
            .attr("y", -margin.left + 15)
            .attr("x", -height / 2)
            .attr("dy", "1em")
            .style("text-anchor", "middle").style("fill", "#333").style("font-size", "12px")
            .text("Sub-Category");

        // Size Scale cho bong bóng (dựa trên Sales)
        // sizes=(10, 300) trong Seaborn là diện tích. D3 scaleSqrt() cho bán kính.
        // Bán kính r. Diện tích A = PI*r^2. Vậy r = sqrt(A/PI).
        // Max size 300 (diện tích) -> max radius sqrt(300/PI) ~ 9.7
        // Min size 10 (diện tích) -> min radius sqrt(10/PI) ~ 1.7
        // Chúng ta sẽ scale bán kính trực tiếp cho đơn giản
        const sizeScale = d3.scaleSqrt()
            .domain([0, maxSales]) // d3.max(dataForChart, d => d.Sales) đã tính ở trên
            .range([2, 10]); // Bán kính bong bóng từ 2px đến 20px (điều chỉnh nếu cần)


        // Grid lines cho trục X
        svg.selectAll("xGrid")
            .data(x.ticks(12)) // Lấy các tick của trục X
            .join("line")
            .attr("x1", d => x(d))
            .attr("x2", d => x(d))
            .attr("y1", 0)
            .attr("y2", height)
            .attr("stroke", "#e0e0e0")
            .attr("stroke-dasharray", "2,2")
            .attr("opacity", 0.5);

        // Vẽ các bong bóng
        const bubbles = svg.append('g')
            .selectAll("circle")
            .data(dataForChart)
            .join("circle")
              .attr("cx", d => x(d.Month))
              .attr("cy", d => y(d['Sub-Category']) + y.bandwidth() / 2) // Căn giữa bong bóng trong band
              .attr("r", d => sizeScale(d.Sales)) // Kích thước dựa trên Sales
              .style("fill", "steelblue") // Giống màu trong code Python
              .attr("opacity", 0.6)
              .style("cursor", "pointer");
        
        // Tooltip
        bubbles
            .on("mouseover", function(event, d) {
                tooltipElement.transition().duration(100).style("opacity", .95);
                tooltipElement.html(
                    `<strong>Sub-Category: ${d['Sub-Category']}</strong><br/>
                     Tháng: ${d3.format("02")(d.Month)}<br/>
                     Doanh thu: $${d.Sales.toLocaleString(undefined, {maximumFractionDigits:0})}`
                )
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
                
                d3.select(this).transition().duration(100)
                    .attr("opacity", 0.9)
                    .style("filter", "brightness(1.2)");
            })
            .on("mouseout", function() {
                tooltipElement.transition().duration(300).style("opacity", 0);
                d3.select(this).transition().duration(100)
                    .attr("opacity", 0.6)
                    .style("filter", "brightness(1)");
            });

        // Tiêu đề cho biểu đồ
        svg.append("text")
            .attr("x", width / 2) 
            .attr("y", 0 - (margin.top / 2))
            .attr("text-anchor", "middle")
            .style("font-size", "16px").style("font-weight", "bold").style("fill", "#333")


    } catch (error) {
        vizContainer.html(`<p style='color:red;'>Lỗi khi vẽ Biểu đồ Q10: ${error.message}</p>`);
        console.error("Lỗi drawChartQ10:", error);
    }
}