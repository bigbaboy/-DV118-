// chartQ8.js

async function drawChartQ8(containerSelector, tooltipElement, dataPath) { // ĐÃ SỬA: Thêm dataPath
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
            // (Kiểm tra lại tên cột trong CSV của bạn, có thể là 'segment' thay vì 'segment')
            if (typeof d.segment === 'undefined' || d.segment === null || String(d.segment).trim() === "") {
                d.segment = "Không xác định";
            }
            // Các cột khác không cần chuyển đổi kiểu cho logic này, chỉ cần tồn tại
        });

        // Bước 1: Đếm số lần mua hàng của mỗi khách hàng trong từng segment
        const ordersByCustomerRollup = d3.rollup(allData,
            v => new Set(v.map(d => d['Order ID'])).size,
            d => d.segment,
            d => d['Customer ID']
        );

        let ordersByCustomer = [];
        ordersByCustomerRollup.forEach((customerMap, segment) => {
            customerMap.forEach((purchaseCount, customerId) => {
                ordersByCustomer.push({
                    segment: segment,
                    'Customer ID': customerId,
                    purchase_count: purchaseCount
                });
            });
        });

        // Bước 2: Chia purchase_count vào các khoảng (bins)
        // bins và labels dựa theo code Python của bạn
        const binsPython = [0, 4, 9, 14, 19, 24, 29, 34, 39, 44]; // Cận trên của mỗi khoảng
        const labelsPython = ['0-4', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34', '35-39', '40-44'];

        ordersByCustomer.forEach(d => {
            d.purchase_range = "N/A"; // Mặc định
            if (d.purchase_count > 0) { // Chỉ gán khoảng nếu có lượt mua
                for (let i = 0; i < labelsPython.length; i++) {
                    // right=True trong pd.cut nghĩa là (cận_dưới, cận_trên]
                    // Ví dụ: labelsPython[0] ('0-4') ứng với purchase_count > 0 và <= binsPython[i] (tức là 4)
                    // labelsPython[1] ('5-9') ứng với purchase_count > binsPython[0] (4) và <= binsPython[1] (9)
                    const lowerBound = (i === 0) ? 0 : binsPython[i-1];
                    if (d.purchase_count > lowerBound && d.purchase_count <= binsPython[i]) {
                        d.purchase_range = labelsPython[i];
                        break;
                    }
                }
                // Nếu purchase_count lớn hơn khoảng cuối cùng
                if (d.purchase_range === "N/A" && d.purchase_count > binsPython[binsPython.length - 1]) {
                    d.purchase_range = `${binsPython[binsPython.length - 1] + 1}+`; // Ví dụ: "45+"
                }
            }
        });
        
        const binnedCustomers = ordersByCustomer.filter(d => d.purchase_range !== "N/A" && d.purchase_count > 0);

        // Bước 3: Đếm số lượng khách hàng trong mỗi segment và mỗi purchase_range
        const customerCountBysegmentRange = d3.rollup(binnedCustomers,
            v => v.length, 
            d => d.purchase_range,
            d => d.segment
        );
        
        let dataForChart = [];
        customerCountBysegmentRange.forEach((segmentMap, purchaseRange) => {
            segmentMap.forEach((count, segment) => {
                dataForChart.push({
                    purchase_range: purchaseRange,
                    segment: segment,
                    count: count
                });
            });
        });
        
        // Tạo thứ tự đúng cho các labels của purchase_range
        const allPurchaseRangeLabels = [...labelsPython];
        if (binnedCustomers.some(d => d.purchase_range === `${binsPython[binsPython.length - 1] + 1}+`)) {
            allPurchaseRangeLabels.push(`${binsPython[binsPython.length - 1] + 1}+`);
        }
        // Sắp xếp dataForChart theo thứ tự purchase_range này
        dataForChart.sort((a, b) => allPurchaseRangeLabels.indexOf(a.purchase_range) - allPurchaseRangeLabels.indexOf(b.purchase_range));

        if (dataForChart.length === 0) {
            vizContainer.html("<p>Không có dữ liệu Phân khúc và Khoảng mua hàng hợp lệ cho Q8.</p>");
            return;
        }
        // console.log("Data for Grouped Bar Chart Q8:", dataForChart);

        // --- BẮT ĐẦU CODE D3.JS VẼ BIỂU ĐỒ CỘT NHÓM ---
        const containerRect = vizContainer.node().getBoundingClientRect();
        const baseWidth = containerRect.width > 0 ? containerRect.width * 0.98 : 700;
        const baseHeight = 450;
        const chartWidth = Math.max(400, baseWidth);
        const chartHeight = Math.max(300, baseHeight);
        const margin = { top: 50, right: 30, bottom: 100, left: 60 };
        const width = chartWidth - margin.left - margin.right;
        const height = chartHeight - margin.top - margin.bottom;

        const svg = vizContainer.append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Trục X chính (Khoảng số lần mua hàng - purchase_range)
        // Lấy các purchase_range duy nhất có trong dataForChart đã sort
        const x0Domain = allPurchaseRangeLabels.filter(l => dataForChart.some(d => d.purchase_range === l));
        const x0 = d3.scaleBand()
            .domain(x0Domain)
            .rangeRound([0, width])
            .paddingInner(0.25); // Tăng padding giữa các nhóm

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x0))
            .selectAll("text")
                .attr("transform", "translate(-10,5)rotate(-40)")
                .style("text-anchor", "end")
                .style("font-size", "9px");
        
        svg.append("text")
            .attr("text-anchor", "middle").attr("x", width / 2).attr("y", height + margin.bottom * 0.85)
            .style("font-size", "12px").text("Khoảng số lần mua hàng");

        // Trục X phụ (Phân khúc khách hàng - cho các cột trong nhóm)
        // **SỬA LỖI: Khai báo segmentOrder ở đây**
        const segmentOrder = ["Consumer", "Corporate", "Home Office"]; // Thứ tự mong muốn
        const segmentsInChart = Array.from(new Set(dataForChart.map(d => d.segment)))
                                         .sort((a,b) => segmentOrder.indexOf(a) - segmentOrder.indexOf(b));
        const x1 = d3.scaleBand()
            .domain(segmentsInChart)
            .rangeRound([0, x0.bandwidth()])
            .padding(0.1); // Padding giữa các cột trong 1 nhóm

        // Trục Y (Số lượng khách hàng)
        const yMaxCount = d3.max(dataForChart, d => d.count);
        const y = d3.scaleLinear()
            .domain([0, yMaxCount > 0 ? yMaxCount * 1.1 : 10])
            .rangeRound([height, 0]);

        svg.append("g")
            .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(",.0f")))
            .append("text")
                .attr("transform", "rotate(-90)").attr("y", -margin.left + 15).attr("x", -height / 2)
                .attr("dy", "1em").style("text-anchor", "middle").style("fill", "#333").style("font-size", "12px")
                .text("Số lượng khách hàng");

        // Màu sắc (palette='viridis' của Seaborn)
        // D3 có d3.interpolateViridis, hoặc bạn có thể định nghĩa mảng màu
        // Hoặc dùng lại màu của Q6, Q7 nếu muốn nhất quán cho segment
        const colorQ8 = d3.scaleOrdinal()
            .domain(segmentOrder) 
            .range(['#440154', '#21908d', '#fde725']); // 3 màu đầu của Viridis
            // Hoặc: .range(['#6574cd', '#fbb6ce', '#fdc9a9']);

        // Gom dữ liệu lại để dễ vẽ cột nhóm
        // const dataGrouped = d3.group(dataForChart, d => d.purchase_range);
        // Thay vì d3.group, sử dụng dataForChart đã được chuẩn bị
        
        // Vẽ các nhóm cột
        const purchaseRangeGroups = svg.selectAll("g.purchase-range-group")
            .data(x0Domain) // Lặp qua các purchase_range trên trục x0
            .join("g")
            .attr("class", "purchase-range-group")
            .attr("transform", d => `translate(${x0(d)},0)`);

        purchaseRangeGroups.selectAll("rect.segment-bar")
            .data(purchaseRangeKey => dataForChart.filter(d => d.purchase_range === purchaseRangeKey)) // Lọc data cho từng purchase_range
            .join("rect")
            .attr("class", "segment-bar")
            .attr("x", d => x1(d.segment))
            .attr("y", d => y(d.count))
            .attr("width", x1.bandwidth())
            .attr("height", d => Math.max(0, height - y(d.count)))
            .attr("fill", d => colorQ8(d.segment))
            .style("cursor", "pointer")
            .on("mouseover", function(event, d) {
                tooltipElement.transition().duration(100).style("opacity", .95);
                tooltipElement.html(
                    `<strong>Khoảng mua: ${d.purchase_range}</strong><br/>
                     Phân khúc: ${d.segment}<br/>
                     Số KH: ${d.count.toLocaleString()}`
                )
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
                d3.select(this).style("filter", "brightness(0.8)");
            })
            .on("mouseout", function() {
                tooltipElement.transition().duration(300).style("opacity", 0);
                d3.select(this).style("filter", "brightness(1)");
            });
        
        // Legend
        const legend = svg.selectAll(".legend-q8")
            .data(segmentsInChart) // Sử dụng segmentsInChart đã được lọc và sort
            .join("g")
            .attr("class", "legend-q8")
            .attr("transform", (d, i) => `translate(${width - margin.right - 60},${i * 20})`); // Vị trí legend ở góc trên phải

        legend.append("rect")
            .attr("x", 0) 
            .attr("width", 18)
            .attr("height", 18)
            .style("fill", colorQ8);

        legend.append("text")
            .attr("x", 25) // Cách rect một chút
            .attr("y", 9)
            .attr("dy", ".35em")
            .style("text-anchor", "start")
            .style("font-size", "10px")
            .text(d => d);

        // Tiêu đề
        svg.append("text")
            .attr("x", width / 2) 
            .attr("y", 0 - (margin.top / 2) - 5)
            .attr("text-anchor", "middle")
            .style("font-size", "15px").style("font-weight", "bold").style("fill", "#333")
   

    } catch (error) {
        vizContainer.html(`<p style='color:red;'>Lỗi khi vẽ Biểu đồ Q8: ${error.message}</p>`);
        console.error("Lỗi drawChartQ8:", error);
    }
}